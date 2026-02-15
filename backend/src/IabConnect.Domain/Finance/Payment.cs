using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-040: Payment record (Zahlung) linked to an invoice.
/// </summary>
public class Payment : Entity, ISoftDeletable
{
    public DateTime Date { get; private set; }
    public decimal Amount { get; private set; }
    public PaymentMethod Method { get; private set; }
    public string? Reference { get; private set; }
    public Guid? InvoiceId { get; private set; }
    public Invoice? Invoice { get; private set; }
    public Guid? TransactionId { get; private set; }
    public Transaction? Transaction { get; private set; }
    public string? Notes { get; private set; }
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
        PaymentMethod method,
        string? reference,
        Guid? invoiceId,
        Guid? transactionId,
        string? notes,
        string updatedBy)
    {
        Date = DateTime.SpecifyKind(date, DateTimeKind.Utc);
        Amount = amount;
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
}
