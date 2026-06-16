using FluentAssertions;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-058 (E8-S1) AC-1/2: Testcontainers-backed persistence tests for <see cref="ApiClientRepository"/>.
/// Round-trips a credential (incl. the comma-joined scope set), exercises the prefix lookup the auth
/// handler relies on, and verifies revoke persists.
/// </summary>
public sealed class ApiClientRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private ApiClientRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new ApiClientRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task RoundTrip_PersistsScopesAndFields()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = ApiClient.Create("Partner", [ApiScopes.EventsRead, ApiScopes.BlogRead], "abc123", "hash-value");

        await _repository.AddAsync(client, ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByIdAsync(client.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.Name.Should().Be("Partner");
        loaded.SecretPrefix.Should().Be("abc123");
        loaded.SecretHash.Should().Be("hash-value");
        loaded.Scopes.Should().BeEquivalentTo([ApiScopes.EventsRead, ApiScopes.BlogRead]);
        loaded.IsRevoked.Should().BeFalse();
    }

    [Fact]
    public async Task GetByPrefix_FindsTheRow()
    {
        var ct = TestContext.Current.CancellationToken;
        await _repository.AddAsync(ApiClient.Create("A", [ApiScopes.EventsRead], "pfx-a", "h1"), ct);
        await _repository.AddAsync(ApiClient.Create("B", [ApiScopes.BlogRead], "pfx-b", "h2"), ct);
        _context.ChangeTracker.Clear();

        var found = await _repository.GetByPrefixAsync("pfx-b", ct);
        found.Should().NotBeNull();
        found!.Name.Should().Be("B");

        (await _repository.GetByPrefixAsync("missing", ct)).Should().BeNull();
    }

    [Fact]
    public async Task Revoke_Persists()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = ApiClient.Create("A", [ApiScopes.EventsRead], "pfx", "h");
        await _repository.AddAsync(client, ct);

        client.Revoke();
        await _repository.UpdateAsync(client, ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByIdAsync(client.Id, ct);
        loaded!.IsRevoked.Should().BeTrue();
        loaded.RevokedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetAll_NewestFirst()
    {
        var ct = TestContext.Current.CancellationToken;
        var older = ApiClient.Create("Older", [ApiScopes.EventsRead], "p1", "h1");
        await _repository.AddAsync(older, ct);
        await Task.Delay(10, ct);
        var newer = ApiClient.Create("Newer", [ApiScopes.EventsRead], "p2", "h2");
        await _repository.AddAsync(newer, ct);
        _context.ChangeTracker.Clear();

        var all = await _repository.GetAllAsync(ct);
        all.Should().HaveCount(2);
        all[0].Name.Should().Be("Newer");
    }
}
