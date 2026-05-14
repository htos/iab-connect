using System.Text;
using FluentAssertions;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-025 (E3.S5 Round-3 R3-H-S5-5 / Epic-3-retro §9 cleanup): coverage for the transactional,
/// FOR UPDATE row-locked calendar-token rotate/revoke service. The headline test is the
/// two-task race (action item A6 discipline): two concurrent rotates on the same member must
/// leave the DB with a hash that matches exactly one of the two returned cleartext tokens —
/// never a torn state where the persisted hash matches neither. Also covers the HMAC-pepper
/// path (R3-H-S5-3): with a pepper configured the stored hash is HMAC-keyed, not plain SHA-256.
/// </summary>
public sealed class CalendarTokenServiceTests : IAsyncLifetime
{
    private const string Pepper = "test-calendar-token-pepper-value";

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

    /// <summary>Builds the service with no pepper configured (plain SHA-256 hashing).</summary>
    private static CalendarTokenService NoPepperService(ApplicationDbContext ctx) =>
        new(ctx, Options.Create(new CalendarTokenOptions()));

    /// <summary>Builds the service with the test pepper configured (HMAC-keyed hashing).</summary>
    private static CalendarTokenService PepperedService(ApplicationDbContext ctx) =>
        new(ctx, Options.Create(new CalendarTokenOptions { CalendarTokenPepper = Pepper }));

    [Fact]
    public async Task RotateAsync_LinkedMember_ProducesNewTokenAndPersistsHash()
    {
        var keycloakId = await SeedMemberAsync();

        await using var ctx = new ApplicationDbContext(_options);
        var result = await NoPepperService(ctx)
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
    public async Task RotateAsync_WithPepper_PersistsHmacKeyedHashNotPlainSha256()
    {
        var keycloakId = await SeedMemberAsync();
        var pepperBytes = Encoding.UTF8.GetBytes(Pepper);

        await using var ctx = new ApplicationDbContext(_options);
        var result = await PepperedService(ctx)
            .RotateAsync(keycloakId, TestContext.Current.CancellationToken);

        result.MemberFound.Should().BeTrue();

        await using var verify = new ApplicationDbContext(_options);
        var row = await verify.Members.AsNoTracking()
            .SingleAsync(m => m.KeycloakUserId == keycloakId, TestContext.Current.CancellationToken);

        // The stored hash is HMAC-SHA256(pepper, SHA256(token)) — and is NOT the plain
        // SHA-256 digest, so a DB-read attacker who also knows the cleartext token cannot
        // confirm the row without the server-side pepper.
        row.CalendarSubscriptionTokenHash.Should().Be(Member.HashCalendarToken(result.Token!, pepperBytes));
        row.CalendarSubscriptionTokenHash.Should().NotBe(Member.HashCalendarToken(result.Token!));
    }

    [Fact]
    public async Task RotateAsync_UnknownKeycloakId_ReturnsNotFound()
    {
        await using var ctx = new ApplicationDbContext(_options);
        var result = await NoPepperService(ctx)
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
            await NoPepperService(rotateCtx)
                .RotateAsync(keycloakId, TestContext.Current.CancellationToken);
        }

        await using var ctx = new ApplicationDbContext(_options);
        var revoked = await NoPepperService(ctx)
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
        var revoked = await NoPepperService(ctx)
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

        var taskA = NoPepperService(ctxA)
            .RotateAsync(keycloakId, TestContext.Current.CancellationToken);
        var taskB = NoPepperService(ctxB)
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

    [Fact]
    public async Task HmacPepperMigration_PgcryptoSql_MatchesDotNetHasher()
    {
        // The HmacPepperCalendarSubscriptionTokens migration re-hashes existing rows in SQL via
        // pgcrypto's hmac(). This test pins that the SQL expression produces byte-for-byte the
        // same value as Member.HashCalendarToken(token, pepper) — if pgcrypto and the .NET
        // hasher ever disagreed, the migration would silently 404 every existing feed.
        const string token = "sample-calendar-token-value";
        var pepperBytes = Encoding.UTF8.GetBytes(Pepper);

        // What the .NET request-time hasher computes.
        var dotNetHmac = Member.HashCalendarToken(token, pepperBytes);
        // The pre-migration stored value: the plain SHA-256 hex digest.
        var storedSha256 = Member.HashCalendarToken(token);

        await using var ctx = new ApplicationDbContext(_options);
        await using var conn = ctx.Database.GetDbConnection();
        await conn.OpenAsync(TestContext.Current.CancellationToken);
        await using (var ext = conn.CreateCommand())
        {
            ext.CommandText = "CREATE EXTENSION IF NOT EXISTS pgcrypto;";
            await ext.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
        }

        await using var cmd = conn.CreateCommand();
        // Mirrors the migration's UPDATE expression exactly.
        cmd.CommandText =
            "SELECT encode(hmac(decode(@sha, 'hex'), convert_to(@pepper, 'UTF8'), 'sha256'), 'hex')";
        var shaParam = cmd.CreateParameter();
        shaParam.ParameterName = "sha";
        shaParam.Value = storedSha256;
        cmd.Parameters.Add(shaParam);
        var pepperParam = cmd.CreateParameter();
        pepperParam.ParameterName = "pepper";
        pepperParam.Value = Pepper;
        cmd.Parameters.Add(pepperParam);

        var sqlHmac = (string?)await cmd.ExecuteScalarAsync(TestContext.Current.CancellationToken);

        sqlHmac.Should().Be(dotNetHmac,
            "the migration's pgcrypto hmac() must produce the same value the .NET hasher checks at request time");
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
