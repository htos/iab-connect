using System.Net;
using FluentAssertions;
using IabConnect.Application.Integration;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Integration;

/// <summary>
/// REQ-058 (E8-S4): claim-before-send dispatch (A66/A67) + delivery-service outcome tests
/// (success / HTTP-failure-rethrow / paused-skip / SSRF-block). HttpClient is stubbed — no real outbound.
/// </summary>
public sealed class WebhookDeliveryServiceTests
{
    private static readonly WebhookSecretService Secrets = new(Options.Create(new WebhookOptions()));
    private static readonly WebhookSignatureService Signatures = new();

    // --- Dispatch: claim-before-send (A66) ---

    [Fact]
    public async Task Dispatch_PersistsPendingRow_ThenEnqueues()
    {
        var subRepo = new InMemorySubRepo();
        var sub = WebhookSubscription.Create("Hook", "https://h.example.com", [WebhookEventTypes.EventCreated], "c");
        await subRepo.AddAsync(sub, TestContext.Current.CancellationToken);
        var deliveryRepo = new InMemoryDeliveryRepo();
        var enqueuer = new FakeEnqueuer();

        var dispatch = new WebhookDispatchService(subRepo, deliveryRepo, enqueuer, NullLogger<WebhookDispatchService>.Instance);
        await dispatch.EmitAsync(WebhookEventTypes.EventCreated, new { eventId = Guid.NewGuid() }, TestContext.Current.CancellationToken);

        deliveryRepo.Rows.Should().ContainSingle().Which.Status.Should().Be(WebhookDeliveryStatus.Pending);
        enqueuer.EnqueuedIds.Should().ContainSingle().Which.Should().Be(deliveryRepo.Rows[0].Id);
    }

    [Fact]
    public async Task Dispatch_DuplicateEmit_CollidesAndAbandons_NoSecondEnqueue()
    {
        var subRepo = new InMemorySubRepo();
        var sub = WebhookSubscription.Create("Hook", "https://h.example.com", [WebhookEventTypes.EventCreated], "c");
        await subRepo.AddAsync(sub, TestContext.Current.CancellationToken);
        var deliveryRepo = new InMemoryDeliveryRepo();
        var enqueuer = new FakeEnqueuer();
        var dispatch = new WebhookDispatchService(subRepo, deliveryRepo, enqueuer, NullLogger<WebhookDispatchService>.Instance);

        var payload = new { eventId = "fixed-id" };
        await dispatch.EmitAsync(WebhookEventTypes.EventCreated, payload, TestContext.Current.CancellationToken);
        await dispatch.EmitAsync(WebhookEventTypes.EventCreated, payload, TestContext.Current.CancellationToken); // same payload → same dedup key

        deliveryRepo.Rows.Should().HaveCount(1, "the duplicate emit collides on the unique dedup key");
        enqueuer.EnqueuedIds.Should().HaveCount(1, "the abandoned duplicate must not enqueue a second delivery");
    }

    // --- Delivery service ---

    private WebhookDeliveryService BuildService(
        InMemoryDeliveryRepo deliveryRepo, InMemorySubRepo subRepo, HttpMessageHandler handler)
        => new(deliveryRepo, subRepo, Secrets, Signatures,
            new StubHttpClientFactory(handler),
            Options.Create(new WebhookDeliveryOptions { PauseThreshold = 3 }),
            NullLogger<WebhookDeliveryService>.Instance);

    private async Task<(WebhookDelivery delivery, WebhookSubscription sub, InMemoryDeliveryRepo dRepo, InMemorySubRepo sRepo)>
        // Literal PUBLIC IP (TEST-NET-2, 198.51.100.0/24) so the SSRF guard bypasses DNS (which would
        // fail-closed offline) and the stubbed HttpClient is actually invoked.
        SeedAsync(string targetUrl = "https://198.51.100.5/hook")
    {
        var secret = Secrets.Generate();
        var sub = WebhookSubscription.Create("Hook", targetUrl, [WebhookEventTypes.EventCreated], secret.ProtectedSecret);
        var sRepo = new InMemorySubRepo();
        await sRepo.AddAsync(sub, TestContext.Current.CancellationToken);
        var delivery = WebhookDelivery.Pending(sub.Id, WebhookEventTypes.EventCreated, targetUrl, "k", "{\"a\":1}");
        var dRepo = new InMemoryDeliveryRepo();
        await dRepo.AddAsync(delivery, TestContext.Current.CancellationToken);
        return (delivery, sub, dRepo, sRepo);
    }

    [Fact]
    public async Task Deliver_Success_MarksDelivered_AndResetsFailures()
    {
        var (delivery, sub, dRepo, sRepo) = await SeedAsync();
        sub.RecordFailure(3); // pre-existing failure streak
        var svc = BuildService(dRepo, sRepo, new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK)));

        await svc.DeliverAsync(delivery.Id, TestContext.Current.CancellationToken);

        dRepo.Rows[0].Status.Should().Be(WebhookDeliveryStatus.Delivered);
        dRepo.Rows[0].ResponseStatusCode.Should().Be(200);
        sRepo.Rows[0].ConsecutiveFailureCount.Should().Be(0);
    }

    [Fact]
    public async Task Deliver_HttpFailure_MarksFailed_RecordsAttempt_AndRethrows()
    {
        var (delivery, _, dRepo, sRepo) = await SeedAsync();
        var svc = BuildService(dRepo, sRepo, new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.InternalServerError)));

        var act = async () => await svc.DeliverAsync(delivery.Id, TestContext.Current.CancellationToken);
        await act.Should().ThrowAsync<Exception>("a non-2xx must rethrow so Hangfire [AutomaticRetry] retries");

        dRepo.Rows[0].Status.Should().Be(WebhookDeliveryStatus.Failed);
        dRepo.Rows[0].AttemptCount.Should().Be(1);
        dRepo.Rows[0].ResponseStatusCode.Should().Be(500);
        sRepo.Rows[0].ConsecutiveFailureCount.Should().Be(1);
    }

    [Fact]
    public async Task Deliver_PausedSubscription_Skips_NoHttpCall()
    {
        var (delivery, sub, dRepo, sRepo) = await SeedAsync();
        sub.Disable(); // not Active
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var svc = BuildService(dRepo, sRepo, handler);

        await svc.DeliverAsync(delivery.Id, TestContext.Current.CancellationToken);

        handler.Calls.Should().Be(0, "a non-active subscription must not be POSTed to");
        dRepo.Rows[0].Status.Should().Be(WebhookDeliveryStatus.Failed);
    }

    [Fact]
    public async Task Deliver_SsrfTarget_Blocked_NoHttpCall()
    {
        var (delivery, _, dRepo, sRepo) = await SeedAsync(targetUrl: "https://127.0.0.1/hook");
        var handler = new StubHandler(_ => new HttpResponseMessage(HttpStatusCode.OK));
        var svc = BuildService(dRepo, sRepo, handler);

        await svc.DeliverAsync(delivery.Id, TestContext.Current.CancellationToken);

        handler.Calls.Should().Be(0, "an internal/loopback target must be blocked before any POST");
        dRepo.Rows[0].Status.Should().Be(WebhookDeliveryStatus.Failed);
        dRepo.Rows[0].Error.Should().Contain("SSRF");
    }

    // --- doubles ---

    private sealed class StubHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _responder;
        public int Calls { get; private set; }
        public StubHandler(Func<HttpRequestMessage, HttpResponseMessage> responder) => _responder = responder;
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
        {
            Calls++;
            return Task.FromResult(_responder(request));
        }
    }

    private sealed class StubHttpClientFactory : IHttpClientFactory
    {
        private readonly HttpMessageHandler _handler;
        public StubHttpClientFactory(HttpMessageHandler handler) => _handler = handler;
        public HttpClient CreateClient(string name) => new(_handler, disposeHandler: false);
    }

    private sealed class FakeEnqueuer : IWebhookDeliveryEnqueuer
    {
        public List<Guid> EnqueuedIds { get; } = [];
        public void Enqueue(Guid deliveryId) => EnqueuedIds.Add(deliveryId);
    }

    private sealed class InMemoryDeliveryRepo : IWebhookDeliveryRepository
    {
        public List<WebhookDelivery> Rows { get; } = [];
        private readonly HashSet<string> _keys = [];

        public Task<WebhookDelivery?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult(Rows.FirstOrDefault(r => r.Id == id));
        public Task<IReadOnlyList<WebhookDelivery>> GetRecentForSubscriptionAsync(Guid subscriptionId, int limit, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<WebhookDelivery>>(Rows.Where(r => r.SubscriptionId == subscriptionId).ToList());
        public Task<(IReadOnlyList<WebhookDelivery> Items, int TotalCount)> GetPagedAsync(Guid? subscriptionId, int page, int pageSize, CancellationToken ct = default)
            => Task.FromResult<(IReadOnlyList<WebhookDelivery>, int)>((Rows, Rows.Count));
        public Task AddAsync(WebhookDelivery delivery, CancellationToken ct = default)
        {
            if (!_keys.Add(delivery.DedupKey))
                throw new DbUpdateException("duplicate dedup key");
            Rows.Add(delivery);
            return Task.CompletedTask;
        }
        public Task UpdateAsync(WebhookDelivery delivery, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class InMemorySubRepo : IWebhookSubscriptionRepository
    {
        public List<WebhookSubscription> Rows { get; } = [];
        public Task<WebhookSubscription?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult(Rows.FirstOrDefault(r => r.Id == id));
        public Task<IReadOnlyList<WebhookSubscription>> GetAllAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<WebhookSubscription>>(Rows);
        public Task<IReadOnlyList<WebhookSubscription>> GetActiveForEventTypeAsync(string eventType, CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<WebhookSubscription>>(
                Rows.Where(r => r.Status == WebhookSubscriptionStatus.Active && r.EventTypes.Contains(eventType)).ToList());
        public Task AddAsync(WebhookSubscription s, CancellationToken ct = default) { Rows.Add(s); return Task.CompletedTask; }
        public Task UpdateAsync(WebhookSubscription s, CancellationToken ct = default) => Task.CompletedTask;
        public Task DeleteAsync(WebhookSubscription s, CancellationToken ct = default) { Rows.Remove(s); return Task.CompletedTask; }
    }
}
