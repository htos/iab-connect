using FluentAssertions;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-025 (E3.S5) AC-10: Calendar-token persistence semantics.
/// Verifies the partial unique index, retrieval, and soft-retire filter.
/// </summary>
public sealed class MemberCalendarTokenRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _ctx = null!;
    private MemberRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        _ctx = new ApplicationDbContext(options);
        await _ctx.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new MemberRepository(_ctx, new DuplicateMatcher());
    }

    public async ValueTask DisposeAsync()
    {
        await _ctx.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task GetByCalendarTokenAsync_ActiveMember_ReturnsRow()
    {
        var member = await CreateActiveMemberAsync("anna@example.com");
        var token = member.RegenerateCalendarToken();
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var found = await _repository.GetByCalendarTokenAsync(token, TestContext.Current.CancellationToken);

        found.Should().NotBeNull();
        found!.Id.Should().Be(member.Id);
    }

    [Fact]
    public async Task GetByCalendarTokenAsync_UnknownToken_ReturnsNull()
    {
        var result = await _repository.GetByCalendarTokenAsync("does-not-exist", TestContext.Current.CancellationToken);
        result.Should().BeNull();
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public async Task GetByCalendarTokenAsync_NullOrWhitespace_ReturnsNull(string? token)
    {
        var result = await _repository.GetByCalendarTokenAsync(token!, TestContext.Current.CancellationToken);
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByCalendarTokenAsync_InactiveMember_ReturnsNull()
    {
        var member = await CreateActiveMemberAsync("inactive@example.com");
        var token = member.RegenerateCalendarToken();
        member.Deactivate();
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var found = await _repository.GetByCalendarTokenAsync(token, TestContext.Current.CancellationToken);

        found.Should().BeNull("inactive members must not emit feeds");
    }

    [Fact]
    public async Task GetByCalendarTokenAsync_MergedRetiredMember_ReturnsNull()
    {
        var sourceMember = await CreateActiveMemberAsync("merged@example.com");
        var targetMember = await CreateActiveMemberAsync("target@example.com");
        var token = sourceMember.RegenerateCalendarToken();
        sourceMember.MarkMergedInto(targetMember.Id, Guid.NewGuid());
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        var found = await _repository.GetByCalendarTokenAsync(token, TestContext.Current.CancellationToken);

        found.Should().BeNull("merged-retired members must not emit feeds");
    }

    [Fact]
    public async Task PartialUniqueIndex_BlocksDuplicateTokens()
    {
        var memberA = await CreateActiveMemberAsync("a@example.com");
        var memberB = await CreateActiveMemberAsync("b@example.com");
        memberA.RegenerateCalendarToken();
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Force the same hash on B via raw SQL — partial unique index must reject.
        // Post-review H-S5-1: column now stores the SHA-256 hex digest, not the cleartext.
        var hashValue = memberA.CalendarSubscriptionTokenHash!;
        Func<Task> act = async () =>
            await _ctx.Database.ExecuteSqlInterpolatedAsync(
                $"UPDATE members SET calendar_subscription_token = {hashValue} WHERE id = {memberB.Id}",
                TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<Exception>();
    }

    [Fact]
    public async Task PartialUniqueIndex_AllowsMultipleNullTokens()
    {
        await CreateActiveMemberAsync("null1@example.com");
        await CreateActiveMemberAsync("null2@example.com");
        await CreateActiveMemberAsync("null3@example.com");
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        // No exception — multiple rows may all have null token.
        var count = await _ctx.Members.CountAsync(TestContext.Current.CancellationToken);
        count.Should().BeGreaterThanOrEqualTo(3);
    }

    [Fact]
    public async Task RegenerateCalendarToken_ProducesNewTokenEachCall()
    {
        var member = await CreateActiveMemberAsync("rotate@example.com");
        var first = member.RegenerateCalendarToken();
        var second = member.RegenerateCalendarToken();

        first.Should().NotBeNullOrWhiteSpace();
        second.Should().NotBeNullOrWhiteSpace();
        first.Should().NotBe(second);
        // Post-review H-S5-1: the entity stores the hash; the cleartext is the return value
        // and is never persisted. Verify both that the stored hash matches the latest token
        // and that the cleartext does NOT survive on the entity.
        member.CalendarSubscriptionTokenHash.Should().Be(Member.HashCalendarToken(second));
        member.CalendarSubscriptionTokenHash.Should().NotBe(second);
    }

    [Fact]
    public async Task RevokeCalendarToken_ClearsField()
    {
        var member = await CreateActiveMemberAsync("revoke@example.com");
        member.RegenerateCalendarToken();
        member.CalendarSubscriptionTokenHash.Should().NotBeNull();
        member.RevokeCalendarToken();
        member.CalendarSubscriptionTokenHash.Should().BeNull();
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<Member> CreateActiveMemberAsync(string email)
    {
        var member = Member.Create("First", "Last", email,
            Address.Create("Street 1", "City", "1000", "Country"),
            MembershipType.Regular);
        member.Activate();
        await _ctx.Members.AddAsync(member, TestContext.Current.CancellationToken);
        await _ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return member;
    }
}
