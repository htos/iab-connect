using IabConnect.Application.Audit;
using IabConnect.Application.Events.PaidRegistration;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-022 (E4-S2): atomic, finance-compliant coordinator for paid event registration.
///
/// <para>One explicit transaction wraps the fiscal-period check, the atomic next-invoice-number
/// allocation (which enlists in the active transaction), and a single <c>SaveChangesAsync</c> that
/// persists BOTH the <see cref="EventRegistration"/> and its linked <see cref="Invoice"/>. If any
/// step throws, the transaction is disposed without committing — neither row is persisted and the
/// invoice-number counter increment rolls back too (AC-3). The invoice is constructed through the
/// same <c>Invoice.Create</c> + <c>AddItemWithTax</c> path the normal create handler uses, so the
/// finance rules are reused, never re-implemented.</para>
/// </summary>
public sealed class PaidRegistrationService : IPaidRegistrationService
{
    private readonly ApplicationDbContext _context;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IFinanceProfileRepository _financeProfileRepository;
    private readonly IAuditService _auditService;

    public PaidRegistrationService(
        ApplicationDbContext context,
        IInvoiceRepository invoiceRepository,
        IFiscalPeriodService fiscalPeriodService,
        IFinanceProfileRepository financeProfileRepository,
        IAuditService auditService)
    {
        _context = context;
        _invoiceRepository = invoiceRepository;
        _fiscalPeriodService = fiscalPeriodService;
        _financeProfileRepository = financeProfileRepository;
        _auditService = auditService;
    }

    public async Task<PaidRegistrationResult> CreatePaidRegistrationAsync(
        EventRegistration registration,
        EventFeeCategory feeCategory,
        string eventTitle,
        DateTime? dueDate,
        CancellationToken cancellationToken = default)
    {
        // AC-1: currency must agree with the active finance profile (the invoice is implicitly in
        // the profile currency — the Invoice entity carries no per-row currency). Reject rather
        // than silently mix currencies.
        var profile = await _financeProfileRepository.GetActiveProfileAsync(cancellationToken);
        if (profile is not null &&
            !string.Equals(profile.Currency.ToString(), feeCategory.Currency, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidOperationException(
                $"Fee category currency '{feeCategory.Currency}' does not match the active finance profile currency '{profile.Currency}'.");
        }

        var now = DateTime.UtcNow;
        var due = DateTime.SpecifyKind(dueDate ?? now.AddDays(30), DateTimeKind.Utc);

        await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);

        // AC-5: honour the fiscal-period lock through the existing service (rare here — the date
        // is "now"). A locked period fails the whole paid registration gracefully.
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(now, cancellationToken);

        // Reuse the atomic, concurrency-safe numbering (enlists in this transaction).
        var invoiceNumber = await _invoiceRepository.GetNextInvoiceNumberAsync(cancellationToken);

        // AC-1: member → RecipientType.Member (+ member id); guest → RecipientType.Other (no id).
        // The registration link is carried by EventRegistrationId, NOT by a new RecipientType.
        var isMember = registration.MemberId.HasValue;
        var recipientType = isMember ? RecipientType.Member : RecipientType.Other;
        var recipientId = isMember ? registration.MemberId : null;

        var invoice = Invoice.Create(
            invoiceNumber,
            now,
            due,
            recipientType,
            recipientId,
            registration.ParticipantName,
            recipientAddress: null,
            // AC-1: default tax-free — most Vereine are VAT-exempt and the fee amount is the gross.
            // No non-zero rate is hardcoded; if VAT handling is later needed it flows via tax codes.
            taxRate: 0m,
            notes: $"Event registration: {eventTitle}",
            createdBy: "System (event registration)",
            paymentTerms: null,
            templateId: null,
            eventRegistrationId: registration.Id);

        invoice.AddItemWithTax(
            description: $"{eventTitle} – {feeCategory.Name}",
            quantity: registration.NumberOfGuests,
            unitPrice: feeCategory.Amount,
            taxCodeId: null,
            taxRate: null,
            isGrossEntry: false,
            activityAreaId: null);

        // AC-3: both tracked by the same context, committed in ONE SaveChangesAsync.
        await _context.EventRegistrations.AddAsync(registration, cancellationToken);
        await _context.Invoices.AddAsync(invoice, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        // AC-9: audit the finance creation AND its registration origin (reconstructable end-to-end).
        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Invoice '{invoice.InvoiceNumber}' raised for paid event registration ({invoice.Total:N2})",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            details: $"eventId={registration.EventId}; registrationId={registration.Id}; feeCategoryId={feeCategory.Id}",
            ct: cancellationToken);

        return new PaidRegistrationResult(registration, invoice.Id, invoice.InvoiceNumber);
    }
}
