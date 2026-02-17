using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-040: Payment record (Zahlung) linked to an invoice.
/// </summary>
public class Payment : Entity, ISoftDeletable
{
    public DateTime Date { get; private set; }
    public decimal Amount { get; private set; }
    public PaymentDirection Direction { get; private set; }
    public PaymentMethod Method { get; private set; }
    public string? Reference { get; private set; }
    public Guid? InvoiceId { get; private set; }
    public Invoice? Invoice { get; private set; }
    public Guid? TransactionId { get; private set; }
    public Transaction? Transaction { get; private set; }
    public string? Notes { get; private set; }

    // REQ-061: Receipt attachment
    public Guid? ReceiptId { get; private set; }
    public Receipt? Receipt { get; private set; }

    // REQ-067: Approval workflow
    public PaymentStatus Status { get; private set; } = PaymentStatus.Draft;
    public string? ApprovedBy { get; private set; }
    public DateTime? ApprovedAt { get; private set; }
    public string? ApprovalComment { get; private set; }
    public string? RejectedBy { get; private set; }
    public DateTime? RejectedAt { get; private set; }
    public string? RejectionReason { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private Payment() { }

    public static Payment Create(
        DateTime date,
        decimal amount,
        PaymentDirection direction,
        PaymentMethod method,
        string? reference,
        Guid? invoiceId,
        Guid? transactionId,
        string? notes,
        string createdBy)
    {
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        return new Payment
        {
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            Amount = amount,
            Direction = direction,
            Method = method,
            Reference = reference?.Trim(),
            InvoiceId = invoiceId,
            TransactionId = transactionId,
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(
        DateTime date,
        decimal amount,
        PaymentDirection direction,
        PaymentMethod method,
        string? reference,
        Guid? invoiceId,
        Guid? transactionId,
        string? notes,
        string updatedBy)
    {
        Date = DateTime.SpecifyKind(date, DateTimeKind.Utc);
        Amount = amount;
        Direction = direction;
        Method = method;
        Reference = reference?.Trim();
        InvoiceId = invoiceId;
        TransactionId = transactionId;
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void SoftDelete(string? deletedBy = null)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }

    // REQ-067: Approval workflow methods

    public void Submit(string submittedBy)
    {
        if (Status != PaymentStatus.Draft)
            throw new InvalidOperationException("Only draft payments can be submitted.");
        Status = PaymentStatus.Submitted;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = submittedBy;
    }

    public void Approve(string approvedBy, string? comment = null)
    {
        if (Status != PaymentStatus.Submitted)
            throw new InvalidOperationException("Only submitted payments can be approved.");
        Status = PaymentStatus.Approved;
        ApprovedBy = approvedBy;
        ApprovedAt = DateTime.UtcNow;
        ApprovalComment = comment?.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = approvedBy;
    }

    public void Reject(string rejectedBy, string reason)
    {
        if (Status != PaymentStatus.Submitted)
            throw new InvalidOperationException("Only submitted payments can be rejected.");
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Rejection reason is required.", nameof(reason));
        Status = PaymentStatus.Rejected;
        RejectedBy = rejectedBy;
        RejectedAt = DateTime.UtcNow;
        RejectionReason = reason.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = rejectedBy;
    }

    public void MarkAsPaid(string paidBy)
    {
        if (Status != PaymentStatus.Approved && Status != PaymentStatus.Draft)
            throw new InvalidOperationException("Only approved or draft payments can be marked as paid.");
        Status = PaymentStatus.Paid;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = paidBy;
    }

    /// <summary>
    /// Checks whether this payment requires approval based on the given thresholds.
    /// </summary>
    public bool RequiresApproval(decimal? thresholdChf, decimal? thresholdEur, FinanceCurrency currency)
    {
        var threshold = currency == FinanceCurrency.CHF ? thresholdChf : thresholdEur;
        return threshold.HasValue && Amount >= threshold.Value;
    }

    /// <summary>
    /// Links this payment to an auto-generated transaction (booking).
    /// </summary>
    public void LinkTransaction(Guid transactionId)
    {
        TransactionId = transactionId;
        UpdatedAt = DateTime.UtcNow;
    }

    public void AttachReceipt(Guid receiptId)
    {
        ReceiptId = receiptId;
    }

    public void DetachReceipt()
    {
        ReceiptId = null;
    }

    /// <summary>
    /// Resets to Draft (e.g., after rejection for resubmission).
    /// </summary>
    public void ResetToDraft(string updatedBy)
    {
        if (Status != PaymentStatus.Rejected)
            throw new InvalidOperationException("Only rejected payments can be reset to draft.");
        Status = PaymentStatus.Draft;
        RejectedBy = null;
        RejectedAt = null;
        RejectionReason = null;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }
}
