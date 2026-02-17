using IabConnect.Application.Finance.Dashboard;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoint for the comprehensive finance dashboard overview.
/// </summary>
public static class DashboardEndpoints
{
    public static void MapDashboardEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/finance/dashboard")
            .WithTags("Finance - Dashboard");

        group.MapGet("/", GetDashboard)
            .RequireAuthorization("RequireFinanceRead")
            .WithName("GetFinanceDashboard")
            .WithSummary("Get comprehensive finance dashboard data")
            .WithDescription("Returns transaction totals, invoice stats, payment stats, expense claim stats, and current fiscal period info.");
    }

    private static async Task<IResult> GetDashboard(ISender sender, CancellationToken ct)
    {
        var dashboard = await sender.Send(new GetFinanceDashboardQuery(), ct);
        return Results.Ok(dashboard);
    }
}
