using IabConnect.Application.Integration;
using IabConnect.Application.Integration.Commands;
using IabConnect.Application.Integration.Queries;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-058 (E8-S3): admin endpoints for webhook subscription management. Admin-only
/// (<c>RequireAdmin</c>), templated on <c>CustomRoleEndpoints</c> + the automation lifecycle
/// sub-routes. Create surfaces the signing secret exactly once. NOT gated by <c>Module:api</c>
/// (self-lockout rule — only the external consumer routes carry the module gate).
/// </summary>
public static class WebhookEndpoints
{
    public static void MapWebhookEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/admin/webhooks")
            .WithTags("Integration - Webhooks")
            .RequireAuthorization("RequireAdmin");

        group.MapGet("/", List).WithName("ListWebhooks");
        group.MapGet("/event-types", GetEventTypes).WithName("GetWebhookEventTypes");
        group.MapPost("/", Create).WithName("CreateWebhook");
        group.MapPut("/{id:guid}", Update).WithName("UpdateWebhook");
        group.MapPost("/{id:guid}/disable", Disable).WithName("DisableWebhook");
        group.MapPost("/{id:guid}/enable", Enable).WithName("EnableWebhook");
        group.MapDelete("/{id:guid}", Delete).WithName("DeleteWebhook");

        // REQ-058 (E8-S4, AC-3): delivery history (per subscription + global). Metadata only (AC-5).
        group.MapGet("/{id:guid}/deliveries", ListDeliveriesForSubscription).WithName("ListWebhookDeliveriesForSubscription");

        var deliveries = app.MapGroup("/api/v1/admin/webhook-deliveries")
            .WithTags("Integration - Webhooks")
            .RequireAuthorization("RequireAdmin");
        deliveries.MapGet("/", ListAllDeliveries).WithName("ListWebhookDeliveries");
    }

    private static async Task<IResult> ListDeliveriesForSubscription(
        Guid id, ISender sender, int? page, int? pageSize, CancellationToken ct)
        => Results.Ok(await sender.Send(new GetWebhookDeliveriesQuery(id, page ?? 1, pageSize ?? 20), ct));

    private static async Task<IResult> ListAllDeliveries(
        ISender sender, Guid? subscriptionId, int? page, int? pageSize, CancellationToken ct)
        => Results.Ok(await sender.Send(new GetWebhookDeliveriesQuery(subscriptionId, page ?? 1, pageSize ?? 20), ct));

    private static async Task<IResult> List(ISender sender, CancellationToken ct)
        => Results.Ok(await sender.Send(new ListWebhookSubscriptionsQuery(), ct));

    /// <summary>Returns the closed event-type whitelist — drives the create-form checkboxes.</summary>
    private static IResult GetEventTypes() => Results.Ok(WebhookEventTypes.All);

    private static async Task<IResult> Create(CreateWebhookRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateWebhookSubscriptionCommand
        {
            Name = request.Name,
            TargetUrl = request.TargetUrl,
            EventTypes = request.EventTypes ?? []
        }, ct);
        return Results.Created($"/api/v1/admin/webhooks/{dto.Id}", dto); // secret returned once
    }

    private static async Task<IResult> Update(Guid id, UpdateWebhookRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateWebhookSubscriptionCommand
        {
            Id = id,
            Name = request.Name,
            TargetUrl = request.TargetUrl,
            EventTypes = request.EventTypes ?? []
        }, ct);
        return dto is null ? Results.NotFound(new { Message = "Webhook subscription not found." }) : Results.Ok(dto);
    }

    private static async Task<IResult> Disable(Guid id, ISender sender, CancellationToken ct)
        => await sender.Send(new DisableWebhookSubscriptionCommand(id), ct)
            ? Results.NoContent() : Results.NotFound(new { Message = "Webhook subscription not found." });

    private static async Task<IResult> Enable(Guid id, ISender sender, CancellationToken ct)
        => await sender.Send(new EnableWebhookSubscriptionCommand(id), ct)
            ? Results.NoContent() : Results.NotFound(new { Message = "Webhook subscription not found." });

    private static async Task<IResult> Delete(Guid id, ISender sender, CancellationToken ct)
        => await sender.Send(new DeleteWebhookSubscriptionCommand(id), ct)
            ? Results.NoContent() : Results.NotFound(new { Message = "Webhook subscription not found." });
}

/// <summary>REQ-058 (E8-S3): create-subscription request body.</summary>
public sealed record CreateWebhookRequest(string Name, string TargetUrl, IReadOnlyCollection<string>? EventTypes);

/// <summary>REQ-058 (E8-S3): update-subscription request body.</summary>
public sealed record UpdateWebhookRequest(string Name, string TargetUrl, IReadOnlyCollection<string>? EventTypes);
