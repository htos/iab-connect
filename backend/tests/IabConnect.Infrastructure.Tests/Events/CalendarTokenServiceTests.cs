using FluentAssertions;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-025 (E3.S5 Round-3 R3-H-S5-5 / Epic-3-retro §9 cleanup): coverage for the transactional,
/// FOR UPDATE row-locked calendar-token rotate/revoke service. The headline test is the
/// two-task race (action item A6 discipline): two concurrent rotates on the same member must
/// leave the DB with a hash that matches exactly one of the two returned cleartext tokens —
/// never a torn state where the persisted hash matches neither.
/// </summary>
public sealed class CalendarTokenServiceTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private DbContextOptions<ApplicationDbContext> _options = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        _options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        await using var seed = new ApplicationDbContext(_options);
        await seed.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task RotateAsync_LinkedMember_ProducesNewTokenAndPersistsHash()
    {
        var keycloakId = await SeedMemberAsync();

        await using var ctx = new ApplicationDbContext(_options);
        var result = await new CalendarTokenService(ctx)
            .RotateAsync(keycloakId, TestContext.Current.CancellationToken);

        result.MemberFound.Should().BeTrue();
        result.Token.Should().NotBeNullOrWhiteSpace();

        await using var verify = new ApplicationDbContext(_options);
        var row = await verify.Members.AsNoTracking()
            .SingleAsync(m => m.KeycloakUserId == keycloakId, TestContext.Current.CancellationToken);
        // Only the hash is persisted — never the cleartext token.
        row.CalendarSubscriptionTokenHash.Should().Be(Member.HashCalendarToken(result.Token!));
        row.CalendarSubscriptionTokenHash.Should().NotBe(result.Token);
    }

    [Fact]
    public async Task RotateAsync_UnknownKeycloakId_ReturnsNotFound()
    {
        await using var ctx = new ApplicationDbContext(_options);
        var result = await new CalendarTokenService(ctx)
            .RotateAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.MemberFound.Should().BeFalse();
        result.Token.Should().BeNull();
    }

    [Fact]
    public async Task RevokeAsync_LinkedMember_ClearsHash()
    {
        var keycloakId = await SeedMemberAsync();
        await using (var rotateCtx = new ApplicationDbContext(_options))
        {
            await new CalendarTokenService(rotateCtx)
                .RotateAsync(keycloakId, TestContext.Current.CancellationToken);
        }

        await using var ctx = new ApplicationDbContext(_options);
        var revoked = await new CalendarTokenService(ctx)
            .RevokeAsync(keycloakId, TestContext.Current.CancellationToken);

        revoked.Should().BeTrue();

        await using var verify = new ApplicationDbContext(_options);
        var row = await verify.Members.AsNoTracking()
            .SingleAsync(m => m.KeycloakUserId == keycloakId, TestContext.Current.CancellationToken);
        row.CalendarSubscriptionTokenHash.Should().BeNull();
    }

    [Fact]
    public async Task RevokeAsync_UnknownKeycloakId_ReturnsFalse()
    {
        await using var ctx = new ApplicationDbContext(_options);
        var revoked = await new CalendarTokenService(ctx)
            .RevokeAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        revoked.Should().BeFalse();
    }

    [Fact]
    public async Task TwoConcurrentRotates_PersistedHashMatchesExactlyOneReturnedToken()
    {
        var keycloakId = await SeedMemberAsync();

        // Two independent DbContext instances simulate two concurrent scoped requests.
        await using var ctxA = new ApplicationDbContext(_options);
        await using var ctxB = new ApplicationDbContext(_options);

        var taskA = new CalendarTokenService(ctxA)
            .RotateAsync(keycloakId, TestContext.Current.CancellationToken);
        var taskB = new CalendarTokenService(ctxB)
            .RotateAsync(keycloakId, TestContext.Current.CancellationToken);

        var results = await Task.WhenAll(taskA, taskB);

        results.Should().AllSatisfy(r =>
        {
            r.MemberFound.Should().BeTrue();
            r.Token.Should().NotBeNullOrWhiteSpace();
        });
        results[0].Token.Should().NotBe(results[1].Token, "each rotate generates a fresh token");

        // The FOR UPDATE lock serialises the two rotates: the persisted hash must equal the
        // hash of exactly ONE of the two returned tokens — never a torn write matching neither.
        await using var verify = new ApplicationDbContext(_options);
        var row = await verify.Members.AsNoTracking()
            .SingleAsync(m => m.KeycloakUserId == keycloakId, TestContext.Current.CancellationToken);

        var candidateHashes = results.Select(r => Member.HashCalendarToken(r.Token!)).ToArray();
        candidateHashes.Should().Contain(row.CalendarSubscriptionTokenHash);
    }

    private async Task<Guid> SeedMemberAsync()
    {
        var keycloakId = Guid.NewGuid();
        await using var ctx = new ApplicationDbContext(_options);

        var member = Member.Create(
            "Test", "Person", $"calendar-{keycloakId:N}@example.com",
            Address.Create("Street 1", "City", "1000", "Country"),
            MembershipType.Regular);
        member.LinkToKeycloak(keycloakId);

        await ctx.Members.AddAsync(member, TestContext.Current.CancellationToken);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return keycloakId;
    }
}
