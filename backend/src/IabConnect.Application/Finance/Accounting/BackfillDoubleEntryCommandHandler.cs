using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;
using Microsoft.Extensions.Logging;

namespace IabConnect.Application.Finance.Accounting;

/// <summary>
/// REQ-084: Backfills journal entries for existing transactions and payments
/// when the FinanceProfile is switched to DoubleEntry mode.
/// Idempotent: skips entities that already have journal entries (via SourceType/SourceId).
/// </summary>
public sealed class BackfillDoubleEntryCommandHandler
    : IRequestHandler<BackfillDoubleEntryCommand, BackfillResultDto>
{
    private readonly ITransactionRepository _transactionRepo;
    private readonly IPaymentRepository _paymentRepo;
    private readonly IJournalEntryRepository _journalEntryRepo;
    private readonly IAccountingPostingService _postingService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly ILogger<BackfillDoubleEntryCommandHandler> _logger;

    public BackfillDoubleEntryCommandHandler(
        ITransactionRepository transactionRepo,
        IPaymentRepository paymentRepo,
        IJournalEntryRepository journalEntryRepo,
        IAccountingPostingService postingService,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        ILogger<BackfillDoubleEntryCommandHandler> logger)
    {
        _transactionRepo = transactionRepo;
        _paymentRepo = paymentRepo;
        _journalEntryRepo = journalEntryRepo;
        _postingService = postingService;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _logger = logger;
    }

    public async Task<BackfillResultDto> Handle(
        BackfillDoubleEntryCommand request, CancellationToken ct)
    {
        _logger.LogInformation(
            "REQ-084: Starting double-entry backfill from {CutOffDate} by {User}",
            request.CutOffDate, request.UserName);

        // Verify double-entry is enabled
        if (!await _postingService.IsDoubleEntryEnabledAsync(ct))
        {
            throw new InvalidOperationException(
                "Double-entry bookkeeping is not enabled. Activate it in the Finance Profile first.");
        }

        var errors = new List<BackfillErrorDto>();
        int journalEntriesCreated = 0;
        int skippedAlreadyPosted = 0;

        // Phase 1: Backfill Transactions
        var transactions = await _transactionRepo.GetAllAsync(
            from: request.CutOffDate, ct: ct);
        // Filter out soft-deleted
        transactions = transactions.Where(t => !t.IsDeleted).ToList();

        _logger.LogInformation("Found {Count} transactions to process", transactions.Count);

        foreach (var transaction in transactions)
        {
            try
            {
                // Idempotency: check if already posted
                var existing = await _journalEntryRepo.GetBySourceAsync(
                    "Transaction", transaction.Id, ct);
                if (existing.Count > 0)
                {
                    skippedAlreadyPosted++;
                    continue;
                }

                var entry = await _postingService.PostTransactionAsync(
                    transaction, request.UserName, ct);

                if (entry != null)
                {
                    journalEntriesCreated++;
                }
                else
                {
                    errors.Add(new BackfillErrorDto
                    {
                        SourceType = "Transaction",
                        SourceId = transaction.Id,
                        Description = transaction.Description,
                        ErrorMessage = "Posting returned null – missing PostingMapping or configuration"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "REQ-084: Failed to post transaction {Id} ({Description})",
                    transaction.Id, transaction.Description);

                errors.Add(new BackfillErrorDto
                {
                    SourceType = "Transaction",
                    SourceId = transaction.Id,
                    Description = transaction.Description,
                    ErrorMessage = ex.Message
                });
            }
        }

        // Phase 2: Backfill Payments (only Paid, not linked to transactions)
        var allPayments = await _paymentRepo.GetAllAsync(ct);
        var eligiblePayments = allPayments
            .Where(p => p.Status == PaymentStatus.Paid
                     && p.Date >= request.CutOffDate
                     && !p.IsDeleted
                     && !p.TransactionId.HasValue) // Skip if already linked to transaction
            .ToList();

        _logger.LogInformation("Found {Count} payments to process", eligiblePayments.Count);

        foreach (var payment in eligiblePayments)
        {
            try
            {
                var existing = await _journalEntryRepo.GetBySourceAsync(
                    "Payment", payment.Id, ct);
                if (existing.Count > 0)
                {
                    skippedAlreadyPosted++;
                    continue;
                }

                var entry = await _postingService.PostPaymentAsync(
                    payment, request.UserName, ct);

                if (entry != null)
                {
                    journalEntriesCreated++;
                }
                else
                {
                    errors.Add(new BackfillErrorDto
                    {
                        SourceType = "Payment",
                        SourceId = payment.Id,
                        Description = $"Payment {payment.Reference ?? payment.Id.ToString()} ({payment.Amount:N2})",
                        ErrorMessage = "Posting returned null – missing PostingMapping or configuration"
                    });
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex,
                    "REQ-084: Failed to post payment {Id}", payment.Id);

                errors.Add(new BackfillErrorDto
                {
                    SourceType = "Payment",
                    SourceId = payment.Id,
                    Description = $"Payment {payment.Reference ?? payment.Id.ToString()} ({payment.Amount:N2})",
                    ErrorMessage = ex.Message
                });
            }
        }

        // Save all changes
        await _unitOfWork.SaveChangesAsync(ct);

        var result = new BackfillResultDto
        {
            TransactionsProcessed = transactions.Count,
            PaymentsProcessed = eligiblePayments.Count,
            JournalEntriesCreated = journalEntriesCreated,
            SkippedAlreadyPosted = skippedAlreadyPosted,
            ErrorCount = errors.Count,
            Errors = errors,
            CutOffDate = request.CutOffDate,
            ExecutedAt = DateTime.UtcNow
        };

        // Audit log
        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"REQ-084: Backfill completed – {journalEntriesCreated} entries created, {errors.Count} errors, {skippedAlreadyPosted} skipped",
            entityType: "Backfill",
            details: $"CutOff: {request.CutOffDate:yyyy-MM-dd}, Transactions: {transactions.Count}, Payments: {eligiblePayments.Count}",
            ct: ct);

        _logger.LogInformation(
            "REQ-084: Backfill completed – Created: {Created}, Skipped: {Skipped}, Errors: {Errors}",
            journalEntriesCreated, skippedAlreadyPosted, errors.Count);

        return result;
    }
}
