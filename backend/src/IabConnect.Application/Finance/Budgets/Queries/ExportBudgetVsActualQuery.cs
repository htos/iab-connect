using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance.Exports.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Queries;

/// <summary>
/// REQ-044 (E6-S3): export the budget-vs-actual report for a fiscal period as CSV.
/// Returns null when the fiscal period does not exist (endpoint maps to 404).
/// </summary>
public sealed record ExportBudgetVsActualQuery(Guid FiscalPeriodId, Guid? ActivityAreaId)
    : IRequest<ExportFileResult?>;

public sealed class ExportBudgetVsActualQueryHandler
    : IRequestHandler<ExportBudgetVsActualQuery, ExportFileResult?>
{
    private readonly ISender _sender;
    private readonly IAuditService _auditService;

    public ExportBudgetVsActualQueryHandler(ISender sender, IAuditService auditService)
    {
        _sender = sender;
        _auditService = auditService;
    }

    public async Task<ExportFileResult?> Handle(ExportBudgetVsActualQuery request, CancellationToken ct)
    {
        var report = await _sender.Send(
            new GetBudgetVsActualQuery(request.FiscalPeriodId, request.ActivityAreaId), ct);
        if (report is null) return null;

        var sb = new StringBuilder();
        sb.AppendLine("CostCenterCode;CostCenterName;FiscalPeriod;Budget;Actual;Variance;VariancePercent;Currency");

        foreach (var row in report.Rows)
        {
            sb.AppendLine(string.Join(";",
                ExportJournalQueryHandler.EscapeCsv(row.ActivityAreaCode),
                ExportJournalQueryHandler.EscapeCsv(row.ActivityAreaName),
                ExportJournalQueryHandler.EscapeCsv(report.FiscalPeriodName),
                row.Budget.ToString("F2", CultureInfo.InvariantCulture),
                row.Actual.ToString("F2", CultureInfo.InvariantCulture),
                row.Variance.ToString("F2", CultureInfo.InvariantCulture),
                row.VariancePercent.ToString("F2", CultureInfo.InvariantCulture),
                ExportJournalQueryHandler.EscapeCsv(row.Currency)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"budget-vs-actual_{report.FiscalPeriodName}.csv";

        await _auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"Budget-vs-actual report exported ({report.Rows.Count} cost centers, period {report.FiscalPeriodName})",
            entityType: "Budget",
            details: $"fiscalPeriodId={request.FiscalPeriodId}, activityAreaId={request.ActivityAreaId?.ToString() ?? "all"}",
            ct: ct);

        return new ExportFileResult(bytes, "text/csv", fileName);
    }
}
