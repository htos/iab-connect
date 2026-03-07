using IabConnect.Application.Finance.Exports.Queries;
using IabConnect.Application.Reporting;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-050: Central dashboard reporting endpoints.
/// REQ-051: Data export endpoints (Members, Events).
/// </summary>
public static class ReportEndpoints
{
    public static void MapReportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/reports")
            .WithTags("Reports & Dashboard");

        // REQ-050: Dashboard
        group.MapGet("/dashboard", GetDashboardOverview)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetDashboardOverview")
            .WithSummary("Get central dashboard with KPIs from Members, Events, and Finance")
            .WithDescription("Returns aggregated statistics for the overview dashboard. Filter by time period with 'from' and 'to' query parameters.");

        group.MapGet("/members/statistics", GetMemberStatistics)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetReportMemberStatistics")
            .WithSummary("Get member statistics for reporting");

        group.MapGet("/finance", GetFinanceSummary)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetReportFinanceSummary")
            .WithSummary("Get finance summary for reporting");

        // REQ-051: Exports
        group.MapGet("/export/members", ExportMembers)
            .RequireAuthorization("RequireAdmin")
            .WithName("ExportMembers")
            .WithSummary("Export all members as CSV")
            .WithDescription("REQ-051: Exports members list with defined columns. Audited.");

        group.MapGet("/export/events/{eventId:guid}/registrations", ExportEventRegistrations)
            .RequireAuthorization("RequireVorstand")
            .WithName("ExportEventRegistrations")
            .WithSummary("Export event registration list as CSV")
            .WithDescription("REQ-051: Exports registrations for a specific event. Audited.");
    }

    private static async Task<IResult> GetDashboardOverview(
        ISender sender,
        DateTime? from,
        DateTime? to,
        CancellationToken ct)
    {
        var query = new GetDashboardOverviewQuery(from, to);
        var result = await sender.Send(query, ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> GetMemberStatistics(
        ISender sender,
        DateTime? from,
        DateTime? to,
        CancellationToken ct)
    {
        var query = new GetDashboardOverviewQuery(from, to);
        var result = await sender.Send(query, ct);
        return Results.Ok(result.Members);
    }

    private static async Task<IResult> GetFinanceSummary(
        ISender sender,
        DateTime? from,
        DateTime? to,
        CancellationToken ct)
    {
        var query = new GetDashboardOverviewQuery(from, to);
        var result = await sender.Send(query, ct);
        return Results.Ok(result.Finance);
    }

    private static async Task<IResult> ExportMembers(
        ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new ExportMembersQuery(), ct);
        return Results.File(result.Content, result.ContentType, result.FileName);
    }

    private static async Task<IResult> ExportEventRegistrations(
        ISender sender, Guid eventId, CancellationToken ct)
    {
        var result = await sender.Send(new ExportEventRegistrationsQuery(eventId), ct);
        return Results.File(result.Content, result.ContentType, result.FileName);
    }
}
