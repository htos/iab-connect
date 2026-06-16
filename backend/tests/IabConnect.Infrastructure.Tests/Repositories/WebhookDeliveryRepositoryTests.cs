using FluentAssertions;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-058 (E8-S4): Testcontainers persistence tests for <see cref="WebhookDeliveryRepository"/> —
/// round-trip, recent-for-subscription ordering, and the load-bearing unique-DedupKey rejection
/// (claim-before-send crash-safety, A66/A67).
/// </summary>
public sealed class WebhookDeliveryRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private WebhookDeliveryRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString()).Options;
        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new WebhookDeliveryRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private static WebhookDelivery Pending(Guid subId, string key) =>
        WebhookDelivery.Pending(subId, WebhookEventTypes.EventCreated, "https://h.example.com", key, "{\"a\":1}");

    [Fact]
    public async Task RoundTrip_PersistsAndUpdates()
    {
        var ct = TestContext.Current.CancellationToken;
        var d = Pending(Guid.NewGuid(), "k1");
        await _repository.AddAsync(d, ct);

        d.BeginAttempt();
        d.MarkDelivered(200);
        await _repository.UpdateAsync(d, ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByIdAsync(d.Id, ct);
        loaded!.Status.Should().Be(WebhookDeliveryStatus.Delivered);
        loaded.ResponseStatusCode.Should().Be(200);
        loaded.AttemptCount.Should().Be(1);
    }

    [Fact]
    public async Task UniqueDedupKey_RejectsDuplicate()
    {
        var ct = TestContext.Current.CancellationToken;
        var subId = Guid.NewGuid();
        await _repository.AddAsync(Pending(subId, "dup-key"), ct);

        var act = async () => await _repository.AddAsync(Pending(subId, "dup-key"), ct);
        await act.Should().ThrowAsync<DbUpdateException>("the unique dedup index is the claim-before-send guard");
    }

    [Fact]
    public async Task Collision_DetachesFailedRow_SubsequentInsertSucceeds_OnSameContext()
    {
        // Boundary-review P1: a unique-DedupKey collision must not poison the DbContext — a later,
        // distinct delivery in the same emit loop must still persist.
        var ct = TestContext.Current.CancellationToken;
        var subId = Guid.NewGuid();
        await _repository.AddAsync(Pending(subId, "dup"), ct);

        var collide = async () => await _repository.AddAsync(Pending(subId, "dup"), ct);
        await collide.Should().ThrowAsync<DbUpdateException>();

        // A different key now succeeds on the SAME context (the failed entity was detached).
        await _repository.AddAsync(Pending(subId, "fresh"), ct);
        _context.ChangeTracker.Clear();

        var rows = await _repository.GetRecentForSubscriptionAsync(subId, 10, ct);
        rows.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetRecentForSubscription_OrdersNewestFirst()
    {
        var ct = TestContext.Current.CancellationToken;
        var subId = Guid.NewGuid();
        await _repository.AddAsync(Pending(subId, "old"), ct);
        await Task.Delay(10, ct);
        await _repository.AddAsync(Pending(subId, "new"), ct);
        _context.ChangeTracker.Clear();

        var recent = await _repository.GetRecentForSubscriptionAsync(subId, 10, ct);
        recent.Should().HaveCount(2);
        recent[0].DedupKey.Should().Be("new");
    }

    [Fact]
    public async Task GetPaged_FiltersBySubscription()
    {
        var ct = TestContext.Current.CancellationToken;
        var subA = Guid.NewGuid();
        var subB = Guid.NewGuid();
        await _repository.AddAsync(Pending(subA, "a1"), ct);
        await _repository.AddAsync(Pending(subB, "b1"), ct);
        _context.ChangeTracker.Clear();

        var (items, total) = await _repository.GetPagedAsync(subA, 1, 20, ct);
        total.Should().Be(1);
        items.Should().ContainSingle(d => d.SubscriptionId == subA);
    }
}
