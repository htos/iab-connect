using System.Net;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Persistence;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-058 (E8-S4, AC-3/5): the delivery-history endpoints return metadata for admins and never expose
/// the raw payload body (the history projection omits it).
/// </summary>
[Collection("Api")]
public sealed class WebhookDeliveryHistoryEndpointTests
{
    private readonly TestWebApplicationFactory _factory;

    public WebhookDeliveryHistoryEndpointTests(TestWebApplicationFactory factory) => _factory = factory;

    private HttpClient Client(params string[] roles)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, Guid.NewGuid().ToString());
        if (roles.Length > 0)
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return client;
    }

    private const string PayloadSentinel = "PAYLOAD_BODY_SENTINEL";

    private async Task<Guid> SeedDeliveryAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var sub = WebhookSubscription.Create("Hook", "https://h.example.com/in", [WebhookEventTypes.EventCreated], "cipher");
        db.WebhookSubscriptions.Add(sub);
        var delivery = WebhookDelivery.Pending(sub.Id, WebhookEventTypes.EventCreated, sub.TargetUrl,
            $"k-{Guid.NewGuid()}", $"{{\"body\":\"{PayloadSentinel}\"}}");
        delivery.BeginAttempt();
        delivery.MarkDelivered(200);
        db.WebhookDeliveries.Add(delivery);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return sub.Id;
    }

    [Fact]
    public async Task DeliveriesForSubscription_AdminReturns200_WithoutPayloadBody()
    {
        var subId = await SeedDeliveryAsync();
        var raw = await Client(Roles.Admin)
            .GetStringAsync($"/api/v1/admin/webhooks/{subId}/deliveries", TestContext.Current.CancellationToken);

        raw.Should().Contain("event.created");
        raw.Should().Contain("Delivered");
        raw.Should().NotContain(PayloadSentinel, "the history projection must omit the raw payload body (AC-5)");
        raw.Should().NotContain("\"payload\"");
    }

    [Fact]
    public async Task GlobalDeliveries_AdminReturns200()
    {
        await SeedDeliveryAsync();
        var resp = await Client(Roles.Admin)
            .GetAsync("/api/v1/admin/webhook-deliveries/", TestContext.Current.CancellationToken);
        resp.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Deliveries_NonAdmin_Returns403()
    {
        var resp = await Client(Roles.Vorstand)
            .GetAsync("/api/v1/admin/webhook-deliveries/", TestContext.Current.CancellationToken);
        resp.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }
}
