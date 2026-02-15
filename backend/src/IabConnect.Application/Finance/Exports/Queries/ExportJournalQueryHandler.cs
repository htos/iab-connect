using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Exports.Queries;

public sealed class ExportJournalQueryHandler : IRequestHandler<ExportJournalQuery, ExportFileResult>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IAuditService _auditService;

    public ExportJournalQueryHandler(
        ITransactionRepository transactionRepository,
        IAuditService auditService)
    {
        _transactionRepository = transactionRepository;
        _auditService = auditService;
    }

    public async Task<ExportFileResult> Handle(ExportJournalQuery request, CancellationToken ct)
    {
        var transactions = await _transactionRepository.GetAllAsync(request.From, request.To, ct: ct);

        var sb = new StringBuilder();
        sb.AppendLine("Date;Description;Amount;Type;AccountId;CategoryId;Reference;Notes");

        foreach (var t in transactions)
        {
            sb.AppendLine(string.Join(";",
                t.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                EscapeCsv(t.Description),
                t.Amount.ToString("F2", CultureInfo.InvariantCulture),
                t.Type.ToString(),
                t.AccountId,
                t.CategoryId?.ToString() ?? "",
                EscapeCsv(t.Reference),
                EscapeCsv(t.Notes)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());
        var fileName = $"journal_{(request.From?.ToString("yyyyMMdd") ?? "all")}_{(request.To?.ToString("yyyyMMdd") ?? "now")}.csv";

        await _auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"Transaction journal exported ({transactions.Count} records)",
            entityType: "Transaction",
            details: $"from={request.From?.ToString("yyyy-MM-dd")}, to={request.To?.ToString("yyyy-MM-dd")}",
            ct: ct);

        return new ExportFileResult(bytes, "text/csv", fileName);
    }

    internal static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }
}
