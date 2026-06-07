using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-058 (E8-S3): API tests for webhook admin CRUD (create-secret-once + audit, list-no-leak,
/// update/disable/delete) and the <c>event.created</c> write-path trigger (asserted via the recording
/// dispatch spy, with a PII-free payload).
/// </summary>
[Collection("Api")]
public sealed class WebhookEndpointTests
{
    private readonly TestWebApplicationFactory _factory;
    private readonly TestWebhookDispatchService _dispatch;

    public WebhookEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _dispatch = factory.Services.GetRequiredService<TestWebhookDispatchService>();
        _dispatch.Reset();
    }

    private HttpClient Client(params string[] roles)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, Guid.NewGuid().ToString());
        if (roles.Length > 0)
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return client;
    }

    [Fact]
    public async Task List_Anonymous_Returns401()
    {
        var r = await _factory.CreateClient().GetAsync("/api/v1/admin/webhooks/", TestContext.Current.CancellationToken);
        r.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task List_NonAdmin_Returns403()
    {
        var r = await Client(Roles.Vorstand).GetAsync("/api/v1/admin/webhooks/", TestContext.Current.CancellationToken);
        r.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task EventTypes_ReturnsWhitelist()
    {
        var r = await Client(Roles.Admin).GetAsync("/api/v1/admin/webhooks/event-types", TestContext.Current.CancellationToken);
        r.StatusCode.Should().Be(HttpStatusCode.OK);
        var types = await r.Content.ReadFromJsonAsync<List<string>>(TestContext.Current.CancellationToken);
        types.Should().Contain(WebhookEventTypes.EventCreated).And.Contain(WebhookEventTypes.PaymentReceived);
    }

    [Fact]
    public async Task Create_ReturnsSecretOnce_AndAudits()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = Client(Roles.Admin);

        var resp = await client.PostAsJsonAsync("/api/v1/admin/webhooks/", new
        {
            name = "Partner hook",
            targetUrl = "https://partner.example.com/hooks/iab",
            eventTypes = new[] { WebhookEventTypes.EventCreated }
        }, ct);

        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await resp.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        created!.Secret.Should().NotBeNullOrEmpty();

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var audit = await db.AuditEvents
            .Where(e => e.EventType == AuditEventType.WebhookSubscriptionChanged && e.EntityId == created.Id.ToString())
            .ToListAsync(ct);
        audit.Should().NotBeEmpty();

        // Stored cipher is not the cleartext secret.
        var entity = await db.WebhookSubscriptions.FirstAsync(w => w.Id == created.Id, ct);
        entity.SecretCipher.Should().NotBe(created.Secret);
    }

    [Fact]
    public async Task Create_InsecureUrl_Returns400()
    {
        var r = await Client(Roles.Admin).PostAsJsonAsync("/api/v1/admin/webhooks/", new
        {
            name = "Bad",
            targetUrl = "http://insecure.example.com",
            eventTypes = new[] { WebhookEventTypes.EventCreated }
        }, TestContext.Current.CancellationToken);
        r.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task List_NeverLeaksSecret()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = Client(Roles.Admin);
        await client.PostAsJsonAsync("/api/v1/admin/webhooks/", new
        {
            name = "Listed",
            targetUrl = "https://listed.example.com/h",
            eventTypes = new[] { WebhookEventTypes.PaymentReceived }
        }, ct);

        var raw = await client.GetStringAsync("/api/v1/admin/webhooks/", ct);
        raw.Should().NotContain("\"secret\"");
        raw.Should().NotContain("secretCipher");
    }

    [Fact]
    public async Task Update_Disable_Enable_Delete_Lifecycle()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = Client(Roles.Admin);
        var created = await (await client.PostAsJsonAsync("/api/v1/admin/webhooks/", new
        {
            name = "Lifecycle",
            targetUrl = "https://life.example.com/h",
            eventTypes = new[] { WebhookEventTypes.EventCreated }
        }, ct)).Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var upd = await client.PutAsJsonAsync($"/api/v1/admin/webhooks/{created!.Id}", new
        {
            name = "Lifecycle v2",
            targetUrl = "https://life2.example.com/h",
            eventTypes = new[] { WebhookEventTypes.EventCreated, WebhookEventTypes.PaymentReceived }
        }, ct);
        upd.StatusCode.Should().Be(HttpStatusCode.OK);

        (await client.PostAsync($"/api/v1/admin/webhooks/{created.Id}/disable", null, ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.PostAsync($"/api/v1/admin/webhooks/{created.Id}/enable", null, ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);
        (await client.DeleteAsync($"/api/v1/admin/webhooks/{created.Id}", ct)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.WebhookSubscriptions.AnyAsync(w => w.Id == created.Id, ct)).Should().BeFalse();
    }

    [Fact]
    public async Task Update_Nonexistent_Returns404()
    {
        var r = await Client(Roles.Admin).PutAsJsonAsync($"/api/v1/admin/webhooks/{Guid.NewGuid()}", new
        {
            name = "x",
            targetUrl = "https://x.example.com",
            eventTypes = new[] { WebhookEventTypes.EventCreated }
        }, TestContext.Current.CancellationToken);
        r.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task CreatingEvent_EmitsEventCreated_WithSafePayload()
    {
        var ct = TestContext.Current.CancellationToken;
        _dispatch.Reset();
        var client = Client(Roles.Vorstand);

        var resp = await client.PostAsJsonAsync("/api/v1/events", new
        {
            title = "Webhook Trigger Event",
            description = "desc",
            location = "Hall",
            startDate = DateTime.UtcNow.AddDays(3),
            endDate = DateTime.UtcNow.AddDays(4),
            contactEmail = "secret-leak@example.com" // must NOT appear in the webhook payload
        }, ct);
        resp.StatusCode.Should().Be(HttpStatusCode.Created);

        var emission = _dispatch.Emissions.Should().ContainSingle(e => e.EventType == WebhookEventTypes.EventCreated).Subject;
        var json = JsonSerializer.Serialize(emission.Payload);
        json.Should().Contain("Webhook Trigger Event");
        json.Should().NotContain("secret-leak@example.com", "the webhook payload must be PII-free");
    }

    private sealed record CreatedResponse(Guid Id, string Name, string TargetUrl, List<string> EventTypes, string Secret, DateTime CreatedAt);
}
