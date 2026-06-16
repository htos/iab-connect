using FluentAssertions;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-058 (E8-S3): Testcontainers persistence tests for <see cref="WebhookSubscriptionRepository"/>,
/// including the dispatch fan-out lookup <see cref="IWebhookSubscriptionRepository.GetActiveForEventTypeAsync"/>.
/// </summary>
public sealed class WebhookSubscriptionRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private WebhookSubscriptionRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString()).Options;
        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new WebhookSubscriptionRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task RoundTrip_PersistsEventTypesAndCipher()
    {
        var ct = TestContext.Current.CancellationToken;
        var sub = WebhookSubscription.Create("Hook", "https://h.example.com/in",
            [WebhookEventTypes.EventCreated, WebhookEventTypes.PaymentReceived], "cipher-x");
        await _repository.AddAsync(sub, ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByIdAsync(sub.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.SecretCipher.Should().Be("cipher-x");
        loaded.EventTypes.Should().BeEquivalentTo([WebhookEventTypes.EventCreated, WebhookEventTypes.PaymentReceived]);
    }

    [Fact]
    public async Task GetActiveForEventType_FiltersByStatusAndType()
    {
        var ct = TestContext.Current.CancellationToken;
        var active = WebhookSubscription.Create("Active", "https://a.example.com", [WebhookEventTypes.EventCreated], "c1");
        var disabled = WebhookSubscription.Create("Disabled", "https://b.example.com", [WebhookEventTypes.EventCreated], "c2");
        disabled.Disable();
        var other = WebhookSubscription.Create("Other", "https://c.example.com", [WebhookEventTypes.PaymentReceived], "c3");
        await _repository.AddAsync(active, ct);
        await _repository.AddAsync(disabled, ct);
        await _repository.AddAsync(other, ct);
        _context.ChangeTracker.Clear();

        var forEventCreated = await _repository.GetActiveForEventTypeAsync(WebhookEventTypes.EventCreated, ct);
        forEventCreated.Should().ContainSingle(s => s.Name == "Active");

        var forPayment = await _repository.GetActiveForEventTypeAsync(WebhookEventTypes.PaymentReceived, ct);
        forPayment.Should().ContainSingle(s => s.Name == "Other");
    }

    [Fact]
    public async Task Delete_RemovesRow()
    {
        var ct = TestContext.Current.CancellationToken;
        var sub = WebhookSubscription.Create("Hook", "https://h.example.com", [WebhookEventTypes.EventCreated], "c");
        await _repository.AddAsync(sub, ct);

        await _repository.DeleteAsync(sub, ct);
        _context.ChangeTracker.Clear();

        (await _repository.GetByIdAsync(sub.Id, ct)).Should().BeNull();
    }
}
