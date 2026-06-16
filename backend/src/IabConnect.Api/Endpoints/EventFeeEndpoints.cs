using System.Security.Claims;
using IabConnect.Api.Authorization;
using IabConnect.Application.Authorization;
using IabConnect.Application.Events.Fees;
using IabConnect.Application.Events.Fees.Commands;
using IabConnect.Application.Events.Fees.Queries;
using IabConnect.Domain.Events;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-022 (E4-S1): API surface for event fee categories, under
/// <c>/api/v1/events/{eventId}/fee-categories</c>. CRUD is gated by <c>RequireEventFeeManager</c>
/// (Admin + Vorstand + EventManager + Kassier — the AC's "Event Manager or Kassier") plus the
/// <c>Module:events</c> gate. Fee CONFIGURATION does not require the Finance module — the Finance
/// dependency lands in E4-S2 (invoice creation on paid registration).
/// </summary>
public static class EventFeeEndpoints
{
    public static IEndpointRouteBuilder MapEventFeeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/events/{eventId:guid}/fee-categories")
            .WithTags("Event Fee Categories")
            .RequireAuthorization()
            .RequireAuthorization("Module:events"); // REQ-087 (E10-S3): events module gate

        group.MapGet("/", GetFeeCategories)
            .RequireAuthorization("RequireEventFeeManager")
            .WithName("GetEventFeeCategories")
            .Produces<IReadOnlyList<EventFeeCategoryDto>>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        group.MapPost("/", CreateFeeCategory)
            .RequireAuthorization("RequireEventFeeManager")
            .WithName("CreateEventFeeCategory")
            .Produces<EventFeeCategoryDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        group.MapPut("/{categoryId:guid}", UpdateFeeCategory)
            .RequireAuthorization("RequireEventFeeManager")
            .WithName("UpdateEventFeeCategory")
            .Produces<EventFeeCategoryDto>()
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        group.MapPost("/{categoryId:guid}/deactivate", DeactivateFeeCategory)
            .RequireAuthorization("RequireEventFeeManager")
            .WithName("DeactivateEventFeeCategory")
            .Produces<EventFeeCategoryDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        // REQ-022 (E4-S3): PUBLIC, read-only list of the fee categories a public visitor can pick
        // when registering — active, available now, applicable to non-members (Everyone/PublicOnly).
        // AllowAnonymous like the public RSVP endpoint; gated by the public_view + events modules.
        endpoints.MapGet("/api/v1/events/public/{eventId:guid}/fee-categories", GetPublicFeeCategories)
            .AllowAnonymous()
            .RequireModule("public_view")
            .RequireModule("events")
            // Code review E4-FT (AC-8): also gate on the Finance module so that when Finance is
            // disabled the page is served NO fee categories and gracefully falls through to free
            // registration, instead of offering a fee the paid branch will then 403.
            .RequireModule("finance")
            .WithTags("Event Fee Categories")
            .WithName("GetPublicEventFeeCategories")
            .Produces<IReadOnlyList<PublicFeeCategoryDto>>()
            .Produces(StatusCodes.Status404NotFound);

        return endpoints;
    }

    private static async Task<IResult> GetPublicFeeCategories(
        Guid eventId,
        IEventRepository eventRepository,
        IEventFeeCategoryRepository feeCategoryRepository,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(eventId);
        if (evt is null || evt.Visibility != EventVisibility.Public || evt.Status != EventStatus.Published)
            return Results.NotFound(new { message = "Event not found" });

        var now = DateTime.UtcNow;
        var categories = await feeCategoryRepository.GetByEventIdAsync(eventId, includeInactive: false, ct);
        var applicable = categories
            .Where(c => c.IsAvailableAt(now) && c.AppliesTo(isMember: false))
            .Select(PublicFeeCategoryDto.FromEntity)
            .ToList();

        return Results.Ok(applicable);
    }

    private static async Task<IResult> GetFeeCategories(
        Guid eventId, bool? includeInactive, ISender sender, CancellationToken ct)
    {
        try
        {
            var result = await sender.Send(new GetEventFeeCategoriesQuery(eventId, includeInactive ?? true), ct);
            return Results.Ok(result);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
    }

    private static async Task<IResult> CreateFeeCategory(
        Guid eventId,
        CreateFeeCategoryRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        if (!TryGetUserId(user, out var userId))
            return Results.BadRequest(new { message = "User id not found." });

        try
        {
            var category = await sender.Send(
                new CreateEventFeeCategoryCommand(
                    eventId, request.Name, request.Description, request.Amount, request.Currency,
                    request.Applicability, request.AvailableFrom, request.AvailableUntil, request.MaxQuantity, userId), ct);
            auditLogger.LogAccessGranted(user, "EventFeeCategory", "Create", category.Id.ToString(),
                new Dictionary<string, object>
                {
                    ["eventId"] = eventId,
                    ["amount"] = category.Amount,
                    ["currency"] = category.Currency,
                });
            return Results.Created($"/api/v1/events/{eventId}/fee-categories/{category.Id}", category);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { message = ex.Message, errorCode = "FeeCategoryNameAlreadyExists" });
        }
    }

    private static async Task<IResult> UpdateFeeCategory(
        Guid eventId,
        Guid categoryId,
        UpdateFeeCategoryRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        try
        {
            var category = await sender.Send(
                new UpdateEventFeeCategoryCommand(
                    eventId, categoryId, request.Name, request.Description, request.Amount, request.Currency,
                    request.Applicability, request.AvailableFrom, request.AvailableUntil, request.MaxQuantity), ct);
            auditLogger.LogAccessGranted(user, "EventFeeCategory", "Update", category.Id.ToString(),
                new Dictionary<string, object>
                {
                    ["eventId"] = eventId,
                    ["amount"] = category.Amount,
                    ["currency"] = category.Currency,
                });
            return Results.Ok(category);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { message = ex.Message, errorCode = "FeeCategoryNameAlreadyExists" });
        }
    }

    private static async Task<IResult> DeactivateFeeCategory(
        Guid eventId,
        Guid categoryId,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        try
        {
            var category = await sender.Send(new DeactivateEventFeeCategoryCommand(eventId, categoryId), ct);
            auditLogger.LogAccessGranted(user, "EventFeeCategory", "Deactivate", category.Id.ToString(),
                new Dictionary<string, object> { ["eventId"] = eventId });
            return Results.Ok(category);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out userId);
    }
}

// ---------- Request DTOs ----------

/// <summary>REQ-022 (E4-S3): public-facing fee category projection (no audit/availability internals).</summary>
public sealed record PublicFeeCategoryDto(Guid Id, string Name, string? Description, decimal Amount, string Currency)
{
    public static PublicFeeCategoryDto FromEntity(EventFeeCategory c) =>
        new(c.Id, c.Name, c.Description, c.Amount, c.Currency);
}

public record CreateFeeCategoryRequest(
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Applicability,
    DateTime? AvailableFrom,
    DateTime? AvailableUntil,
    int? MaxQuantity);

public record UpdateFeeCategoryRequest(
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Applicability,
    DateTime? AvailableFrom,
    DateTime? AvailableUntil,
    int? MaxQuantity);
