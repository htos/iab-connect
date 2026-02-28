using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance.Jobs;

/// <summary>
/// REQ-039: Marks all sent invoices past their due date as overdue.
/// Idempotent — invoices already in Overdue status are skipped.
/// </summary>
public sealed class MarkInvoicesOverdueService : IMarkInvoicesOverdueService
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<MarkInvoicesOverdueService> _logger;

    public MarkInvoicesOverdueService(
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork,
        ILogger<MarkInvoicesOverdueService> logger)
    {
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<int> ExecuteAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("MarkInvoicesOverdue: Starting scan for overdue invoices");

        var sentInvoices = await _invoiceRepository.GetAllAsync(InvoiceStatus.Sent, ct: ct);

        var today = DateTime.UtcNow.Date;
        var overdueInvoices = sentInvoices
            .Where(i => i.DueDate < today && !i.IsDeleted)
            .ToList();

        if (overdueInvoices.Count == 0)
        {
            _logger.LogInformation("MarkInvoicesOverdue: No overdue invoices found");
            return 0;
        }

        var markedCount = 0;
        foreach (var invoice in overdueInvoices)
        {
            try
            {
                invoice.MarkAsOverdue("system-job");
                await _invoiceRepository.UpdateAsync(invoice, ct);
                markedCount++;
            }
            catch (InvalidOperationException ex)
            {
                // Idempotent: if invoice is no longer in Sent status, skip gracefully
                _logger.LogDebug(
                    ex,
                    "MarkInvoicesOverdue: Skipping invoice {InvoiceNumber} — {Reason}",
                    invoice.InvoiceNumber,
                    ex.Message);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation(
            "MarkInvoicesOverdue: Marked {Count} invoice(s) as overdue out of {Total} candidate(s)",
            markedCount,
            overdueInvoices.Count);

        return markedCount;
    }
}
