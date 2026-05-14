using IabConnect.Application.Finance.Accounting.Reports;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-079/080/081: Accounting report endpoints (Trial Balance, Balance Sheet, P&L).
/// </summary>
public static class AccountingReportEndpoints
{
    public static WebApplication MapAccountingReportEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/finance/accounting-reports")
            .WithTags("Finance - Accounting Reports")
            .RequireAuthorization("Module:finance"); // REQ-087 (E10-S3): finance module gate

        group.MapGet("/trial-balance", async (DateTime? from, DateTime? to, ISender sender, CancellationToken ct) =>
        {
            var report = await sender.Send(new GetTrialBalanceQuery { From = from, To = to }, ct);
            return Results.Ok(report);
        })
        .WithName("GetTrialBalance")
        .WithDescription("REQ-079: Trial balance (Saldenliste) for all ledger accounts")
        .RequireAuthorization("RequireFinanceRead");

        group.MapGet("/balance-sheet", async (DateTime? asOfDate, ISender sender, CancellationToken ct) =>
        {
            var report = await sender.Send(new GetBalanceSheetQuery { AsOfDate = asOfDate }, ct);
            return Results.Ok(report);
        })
        .WithName("GetBalanceSheet")
        .WithDescription("REQ-080: Balance sheet (Bilanz) as of a given date")
        .RequireAuthorization("RequireFinanceRead");

        group.MapGet("/profit-and-loss", async (DateTime? from, DateTime? to, ISender sender, CancellationToken ct) =>
        {
            var report = await sender.Send(new GetProfitAndLossQuery { From = from, To = to }, ct);
            return Results.Ok(report);
        })
        .WithName("GetProfitAndLoss")
        .WithDescription("REQ-081: Profit & Loss (Erfolgsrechnung) for a period")
        .RequireAuthorization("RequireFinanceRead");

        return app;
    }
}
