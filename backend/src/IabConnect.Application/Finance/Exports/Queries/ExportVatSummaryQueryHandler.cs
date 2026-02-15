using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Exports.Queries;

public sealed class ExportVatSummaryQueryHandler : IRequestHandler<ExportVatSummaryQuery, ExportFileResult>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAuditService _auditService;

    public ExportVatSummaryQueryHandler(
        ITransactionRepository transactionRepository,
        IAuditService auditService)
    {
        _transactionRepository = transactionRepository;
        _auditService = auditService;
    }

    public async Task<ExportFileResult> Handle(ExportVatSummaryQuery request, CancellationToken ct)
    {
        var transactions = await _transactionRepository.GetAllAsync(request.From, request.To, ct: ct);
        var taxedTransactions = transactions.Where(t => t.TaxCodeId.HasValue && t.TaxRate.HasValue).ToList();

        var groups = taxedTransactions
            .GroupBy(t => new { t.TaxCodeId, t.TaxRate })
            .Select(g => new
            {
                g.Key.TaxCodeId,
                TaxRate = g.Key.TaxRate!.Value,
                NetAmount = g.Sum(t => t.NetAmount ?? 0m),
                TaxAmount = g.Sum(t => t.TaxAmount ?? 0m),
                GrossAmount = g.Sum(t => t.Amount),
                TransactionCount = g.Count()
            })
            .OrderBy(g => g.TaxRate)
            .ToList();

        var period = $"{(request.From?.ToString("yyyy-MM-dd") ?? "all")} - {(request.To?.ToString("yyyy-MM-dd") ?? "now")}";

        var sb = new StringBuilder();
        sb.AppendLine("Period;TaxCodeId;TaxRate;NetAmount;TaxAmount;GrossAmount;TransactionCount");

        foreach (var g in groups)
        {
            sb.AppendLine(string.Join(";",
                period,
                g.TaxCodeId?.ToString() ?? "",
                g.TaxRate.ToString("F4", CultureInfo.InvariantCulture),
                g.NetAmount.ToString("F2", CultureInfo.InvariantCulture),
                g.TaxAmount.ToString("F2", CultureInfo.InvariantCulture),
                g.GrossAmount.ToString("F2", CultureInfo.InvariantCulture),
                g.TransactionCount));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"vat_summary_{(request.From?.ToString("yyyyMMdd") ?? "all")}_{(request.To?.ToString("yyyyMMdd") ?? "now")}.csv";

        await _auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"VAT summary exported ({groups.Count} tax groups, {taxedTransactions.Count} transactions)",
            entityType: "Transaction",
            details: $"from={request.From?.ToString("yyyy-MM-dd")}, to={request.To?.ToString("yyyy-MM-dd")}",
            ct: ct);

        return new ExportFileResult(bytes, "text/csv", fileName);
    }
}
