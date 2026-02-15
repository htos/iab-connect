using System.Globalization;
using System.Text;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Exports.Queries;

public sealed class ExportOpenItemsQueryHandler : IRequestHandler<ExportOpenItemsQuery, ExportFileResult>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IAuditService _auditService;

    public ExportOpenItemsQueryHandler(
        IInvoiceRepository invoiceRepository,
        IAuditService auditService)
    {
        _invoiceRepository = invoiceRepository;
        _auditService = auditService;
    }

    public async Task<ExportFileResult> Handle(ExportOpenItemsQuery request, CancellationToken ct)
    {
        var invoices = await _invoiceRepository.GetOpenItemsAsync(ct);

        var sb = new StringBuilder();
        sb.AppendLine("InvoiceNumber;Date;DueDate;Status;RecipientName;Total");

        foreach (var inv in invoices)
        {
            sb.AppendLine(string.Join(";",
                ExportJournalQueryHandler.EscapeCsv(inv.InvoiceNumber),
                inv.Date.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                inv.DueDate.ToString("yyyy-MM-dd", CultureInfo.InvariantCulture),
                inv.Status.ToString(),
                ExportJournalQueryHandler.EscapeCsv(inv.RecipientName),
                inv.Total.ToString("F2", CultureInfo.InvariantCulture)));
        }

        var bytes = Encoding.UTF8.GetBytes(sb.ToString());

        await _auditService.LogActionAsync(
            AuditEventType.FinanceExported,
            $"Open items exported ({invoices.Count} invoices)",
            entityType: "Invoice",
            ct: ct);

        return new ExportFileResult(bytes, "text/csv", "open_items.csv");
    }
}
