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
/// REQ-018 (E2.S2): Testcontainers-backed integration tests for the normalized email
/// lookups added to <see cref="MemberRepository"/>. Verifies case-insensitive ILIKE
/// matching, <c>+tag</c> stripping, and <c>AsNoTracking</c> behavior against a real
/// PostgreSQL instance (relational semantics cannot be proven against EF InMemory).
/// </summary>
public class MemberRepositoryEmailNormalizedTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private MemberRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        _repository = new MemberRepository(_context, new DuplicateMatcher());

        await SeedAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_CaseDifferentStoredEmail_ReturnsMember()
    {
        var result = await _repository.GetByEmailNormalizedAsync(
            "max@example.com", TestContext.Current.CancellationToken);

        result.Should().NotBeNull();
        result!.Email.Should().Be("Max@Example.COM");
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_InputWithPlusTag_MatchesPlainStoredEmail()
    {
        // Stored: "Max@Example.COM"; input local-part = "max", domain = "example.com".
        // Normalize input "max+anything@example.com" -> "max@example.com" -> matches stored case-insensitively.
        var result = await _repository.GetByEmailNormalizedAsync(
            "max+anything@example.com", TestContext.Current.CancellationToken);

        result.Should().NotBeNull();
        result!.Email.Should().Be("Max@Example.COM");
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_PlainInput_MatchesStoredPlusTag()
    {
        // Stored: "anna+work@example.com"; input "anna@example.com" should match via the +%@ branch.
        var result = await _repository.GetByEmailNormalizedAsync(
            "anna@example.com", TestContext.Current.CancellationToken);

        result.Should().NotBeNull();
        result!.Email.Should().Be("anna+work@example.com");
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_NoMatch_ReturnsNull()
    {
        var result = await _repository.GetByEmailNormalizedAsync(
            "noone@example.com", TestContext.Current.CancellationToken);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_PrefixSubstringInput_DoesNotProduceFalsePositive()
    {
        // "maxima@example.com" must NOT match the stored "Max@Example.COM" record --
        // the +%@ pattern requires a literal '+' so "maxima" cannot satisfy "max+%@example.com",
        // and exact ILIKE does not allow prefix substring.
        var result = await _repository.GetByEmailNormalizedAsync(
            "maxima@example.com", TestContext.Current.CancellationToken);

        result.Should().BeNull();
    }

    [Theory]
    [InlineData("anna@example.com", true)]
    [InlineData("ANNA+OTHER@example.com", true)]
    [InlineData("anna+work@example.com", true)]
    [InlineData("nobody@example.com", false)]
    public async Task EmailExistsNormalizedAsync_MatchesUnderNormalization(
        string input, bool expected)
    {
        var exists = await _repository.EmailExistsNormalizedAsync(
            input, TestContext.Current.CancellationToken);

        exists.Should().Be(expected);
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_ProducesNoTrackedEntities()
    {
        _context.ChangeTracker.Clear();

        var result = await _repository.GetByEmailNormalizedAsync(
            "max@example.com", TestContext.Current.CancellationToken);

        result.Should().NotBeNull();
        _context.ChangeTracker.Entries().Should().BeEmpty();
    }

    [Fact]
    public async Task GetByEmailNormalizedAsync_EmptyOrInvalidInput_ReturnsNull()
    {
        (await _repository.GetByEmailNormalizedAsync("", TestContext.Current.CancellationToken))
            .Should().BeNull();
        (await _repository.GetByEmailNormalizedAsync("   ", TestContext.Current.CancellationToken))
            .Should().BeNull();
        (await _repository.GetByEmailNormalizedAsync("@example.com", TestContext.Current.CancellationToken))
            .Should().BeNull();
        (await _repository.GetByEmailNormalizedAsync("noatsign", TestContext.Current.CancellationToken))
            .Should().BeNull();
    }

    private async Task SeedAsync()
    {
        var members = new[]
        {
            Member.Create(
                "Max",
                "Mustermann",
                "Max@Example.COM",
                Address.Create("Bundesplatz 1", "Bern", "3011", "Schweiz"),
                MembershipType.Regular,
                null),
            Member.Create(
                "Anna",
                "Beispiel",
                "anna+work@example.com",
                Address.Create("Bahnhofstrasse 2", "Bern", "3011", "Schweiz"),
                MembershipType.Student,
                null),
        };

        foreach (var m in members)
            await _context.Members.AddAsync(m, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
