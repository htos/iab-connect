using IabConnect.Application.Retention;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-057: Retention policy admin endpoints.
/// </summary>
public static class RetentionEndpoints
{
    public static WebApplication MapRetentionEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/admin/retention")
            .WithTags("Admin - Retention Policies")
            .RequireAuthorization("RequireAdmin");

        group.MapGet("", GetPolicies)
            .WithName("GetRetentionPolicies")
            .WithSummary("REQ-057: List all retention policies");

        group.MapGet("/{id:guid}", GetPolicy)
            .WithName("GetRetentionPolicy")
            .WithSummary("REQ-057: Get a specific retention policy");

        group.MapPut("/{id:guid}", UpdatePolicy)
            .WithName("UpdateRetentionPolicy")
            .WithSummary("REQ-057: Update a retention policy");

        group.MapPost("/enforce", EnforcePolicies)
            .WithName("EnforceRetentionPolicies")
            .WithSummary("REQ-057: Manually trigger retention enforcement");

        return app;
    }

    private static async Task<IResult> GetPolicies(IMediator mediator)
    {
        var result = await mediator.Send(new GetRetentionPoliciesQuery());
        return Results.Ok(result);
    }

    private static async Task<IResult> GetPolicy(Guid id, IMediator mediator)
    {
        var result = await mediator.Send(new GetRetentionPolicyByIdQuery(id));
        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> UpdatePolicy(
        Guid id,
        UpdateRetentionPolicyRequest request,
        IMediator mediator)
    {
        var result = await mediator.Send(new UpdateRetentionPolicyCommand(
            id,
            request.DisplayName,
            request.RetentionMonths,
            request.Action,
            request.LegalBasis,
            request.IsActive));

        return result is null ? Results.NotFound() : Results.Ok(result);
    }

    private static async Task<IResult> EnforcePolicies(IMediator mediator)
    {
        var count = await mediator.Send(new EnforceRetentionCommand());
        return Results.Ok(new { processedRecords = count });
    }

    private sealed record UpdateRetentionPolicyRequest(
        string DisplayName,
        int RetentionMonths,
        string Action,
        string? LegalBasis,
        bool IsActive);
}
