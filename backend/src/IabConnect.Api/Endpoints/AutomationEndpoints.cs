using IabConnect.Api.Extensions;
using IabConnect.Application.Communication.Automations.Commands;
using IabConnect.Application.Communication.Automations.Queries;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-028 (E5-S1): API endpoints for automation definitions (journeys). Thin Minimal-API handlers
/// that dispatch MediatR commands/queries. The route group requires <c>RequireVorstand</c> (Admin
/// OR Vorstand) AND <c>Module:communication</c> — identical to the email-campaign surface (DEC-4,
/// AC-6). Frontend role checks (S3) are UX only; this is the security boundary.
/// </summary>
public static class AutomationEndpoints
{
    public static void MapAutomationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/automations")
            .WithTags("Communication - Automations")
            .RequireAuthorization("RequireVorstand")
            .RequireAuthorization("Module:communication"); // REQ-087 (E10-S3): communication module gate

        group.MapGet("/", GetAutomations).WithName("GetAutomations");
        group.MapGet("/{id:guid}", GetAutomationById).WithName("GetAutomation");
        group.MapPost("/", CreateAutomation).WithName("CreateAutomation");
        group.MapPut("/{id:guid}", UpdateAutomation).WithName("UpdateAutomation");

        group.MapPost("/{id:guid}/activate", ActivateAutomation).WithName("ActivateAutomation");
        group.MapPost("/{id:guid}/pause", PauseAutomation).WithName("PauseAutomation");
        group.MapPost("/{id:guid}/resume", ResumeAutomation).WithName("ResumeAutomation");
        group.MapPost("/{id:guid}/disable", DisableAutomation).WithName("DisableAutomation");

        group.MapPost("/recipients/preview", PreviewRecipients).WithName("PreviewAutomationRecipients");

        group.MapGet("/{id:guid}/executions", GetExecutions).WithName("GetAutomationExecutions");
    }

    private static async Task<IResult> GetExecutions(Guid id, ISender sender, int? limit, CancellationToken ct)
    {
        var result = await sender.Send(new GetAutomationExecutionsQuery(id, limit ?? 10), ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetAutomations(
        ISender sender,
        string? search,
        AutomationStatus? status,
        int? page,
        int? pageSize,
        CancellationToken ct)
    {
        var result = await sender.Send(new GetAutomationsQuery
        {
            Search = search,
            Status = status,
            Page = page ?? 1,
            PageSize = pageSize ?? 20
        }, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetAutomationById(Guid id, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new GetAutomationByIdQuery(id), ct);
        return dto is null ? Results.NotFound(new { Message = "Automation not found." }) : Results.Ok(dto);
    }

    private static async Task<IResult> CreateAutomation(
        CreateAutomationRequest request, ISender sender, HttpContext httpContext, CancellationToken ct)
    {
        var dto = await sender.Send(new CreateAutomationCommand
        {
            Name = request.Name,
            Description = request.Description,
            TemplateId = request.TemplateId,
            TriggerType = request.TriggerType,
            OffsetDays = request.OffsetDays,
            SegmentType = request.SegmentType,
            SegmentFilter = request.SegmentFilter,
            ConsentFilter = request.ConsentFilter,
            CreatedById = httpContext.GetUserId(),
            CreatedByName = httpContext.GetUserName()
        }, ct);
        return Results.Created($"/api/v1/automations/{dto.Id}", dto);
    }

    private static async Task<IResult> UpdateAutomation(
        Guid id, UpdateAutomationRequest request, ISender sender, CancellationToken ct)
    {
        var dto = await sender.Send(new UpdateAutomationCommand
        {
            Id = id,
            Name = request.Name,
            Description = request.Description,
            TemplateId = request.TemplateId,
            TriggerType = request.TriggerType,
            OffsetDays = request.OffsetDays,
            SegmentType = request.SegmentType,
            SegmentFilter = request.SegmentFilter,
            ConsentFilter = request.ConsentFilter
        }, ct);
        return dto is null ? Results.NotFound(new { Message = "Automation not found." }) : Results.Ok(dto);
    }

    private static async Task<IResult> ActivateAutomation(Guid id, ISender sender, CancellationToken ct)
        => Lifecycle(await sender.Send(new ActivateAutomationCommand(id), ct));

    private static async Task<IResult> PauseAutomation(Guid id, ISender sender, CancellationToken ct)
        => Lifecycle(await sender.Send(new PauseAutomationCommand(id), ct));

    private static async Task<IResult> ResumeAutomation(Guid id, ISender sender, CancellationToken ct)
        => Lifecycle(await sender.Send(new ResumeAutomationCommand(id), ct));

    private static async Task<IResult> DisableAutomation(Guid id, ISender sender, CancellationToken ct)
        => Lifecycle(await sender.Send(new DisableAutomationCommand(id), ct));

    private static IResult Lifecycle(Application.Communication.Automations.AutomationDetailDto? dto)
        => dto is null ? Results.NotFound(new { Message = "Automation not found." }) : Results.Ok(dto);

    private static async Task<IResult> PreviewRecipients(
        PreviewAutomationRecipientsRequest request, ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new PreviewAutomationRecipientsQuery
        {
            SegmentType = request.SegmentType,
            SegmentFilter = request.SegmentFilter,
            ConsentFilter = request.ConsentFilter
        }, ct);
        return Results.Ok(result);
    }
}

// Request DTOs
public sealed record CreateAutomationRequest(
    string Name,
    string? Description,
    int TemplateId,
    AutomationTriggerType TriggerType,
    int? OffsetDays,
    RecipientSegmentType SegmentType,
    string? SegmentFilter,
    ConsentType? ConsentFilter);

public sealed record UpdateAutomationRequest(
    string Name,
    string? Description,
    int TemplateId,
    AutomationTriggerType TriggerType,
    int? OffsetDays,
    RecipientSegmentType SegmentType,
    string? SegmentFilter,
    ConsentType? ConsentFilter);

public sealed record PreviewAutomationRecipientsRequest(
    RecipientSegmentType SegmentType,
    string? SegmentFilter,
    ConsentType? ConsentFilter);
