using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance.Jobs;

/// <summary>
/// REQ-042: Generates dunning notices for overdue invoices that don't already have a recent notice.
/// Idempotent — invoices with a dunning notice created within the configured grace period are skipped.
/// </summary>
public sealed class DunningScheduleService : IDunningScheduleService
{
    /// <summary>
    /// Default grace period in days. If a dunning notice was created within this window, skip.
    /// </summary>
    public const int DefaultGracePeriodDays = 14;

    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IDunningNoticeRepository _dunningNoticeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DunningScheduleService> _logger;

    public DunningScheduleService(
        IInvoiceRepository invoiceRepository,
        IDunningNoticeRepository dunningNoticeRepository,
        IUnitOfWork unitOfWork,
        ILogger<DunningScheduleService> logger)
    {
        _invoiceRepository = invoiceRepository;
        _dunningNoticeRepository = dunningNoticeRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task<int> ExecuteAsync(CancellationToken ct = default)
    {
        _logger.LogInformation("DunningSchedule: Starting scan for overdue invoices needing dunning");

        var overdueInvoices = await _invoiceRepository.GetAllAsync(InvoiceStatus.Overdue, ct: ct);
        var activeOverdue = overdueInvoices.Where(i => !i.IsDeleted).ToList();

        if (activeOverdue.Count == 0)
        {
            _logger.LogInformation("DunningSchedule: No overdue invoices found");
            return 0;
        }

        var cutoff = DateTime.UtcNow.AddDays(-DefaultGracePeriodDays);
        var createdCount = 0;

        foreach (var invoice in activeOverdue)
        {
            var existingNotices = await _dunningNoticeRepository.GetByInvoiceIdAsync(invoice.Id, ct);
            var recentNotice = existingNotices
                .Where(d => !d.IsDeleted)
                .Any(d => d.Date >= cutoff);

            if (recentNotice)
            {
                _logger.LogDebug(
                    "DunningSchedule: Skipping invoice {InvoiceNumber} — recent dunning notice exists",
                    invoice.InvoiceNumber);
                continue;
            }

            var nextLevel = existingNotices
                .Where(d => !d.IsDeleted)
                .Select(d => d.Level)
                .DefaultIfEmpty(0)
                .Max() + 1;

            // DunningNotice.Create enforces max level 3
            if (nextLevel > 3)
            {
                _logger.LogWarning(
                    "DunningSchedule: Invoice {InvoiceNumber} already at max dunning level (3), skipping",
                    invoice.InvoiceNumber);
                continue;
            }

            var notice = DunningNotice.Create(
                invoice.Id,
                nextLevel,
                DateTime.UtcNow.AddDays(DefaultGracePeriodDays),
                $"Auto-generated dunning (level {nextLevel})",
                "system-job");

            await _dunningNoticeRepository.AddAsync(notice, ct);
            createdCount++;
        }

        await _unitOfWork.SaveChangesAsync(ct);

        _logger.LogInformation(
            "DunningSchedule: Created {Count} dunning notice(s) for {Total} overdue invoice(s)",
            createdCount,
            activeOverdue.Count);

        return createdCount;
    }
}
