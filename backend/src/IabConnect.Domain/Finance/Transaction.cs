using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-038: Financial transaction (Buchung) - income or expense entry.
/// </summary>
public class Transaction : Entity
{
    public DateTime Date { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public TransactionType Type { get; private set; }
    public Guid AccountId { get; private set; }
    public Account Account { get; private set; } = null!;
    public Guid? CategoryId { get; private set; }
    public Category? Category { get; private set; }
    public string? Reference { get; private set; }
    public string? Notes { get; private set; }
    public Guid? ReceiptId { get; private set; }
    public Receipt? Receipt { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }

    private Transaction() { }

    public static Transaction Create(
        DateTime date,
        string description,
        decimal amount,
        TransactionType type,
        Guid accountId,
        Guid? categoryId,
        string? reference,
        string? notes,
        string createdBy)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        return new Transaction
        {
            Date = date,
            Description = description.Trim(),
            Amount = amount,
            Type = type,
            AccountId = accountId,
            CategoryId = categoryId,
            Reference = reference?.Trim(),
            Notes = notes?.Trim(),
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(
        DateTime date,
        string description,
        decimal amount,
        TransactionType type,
        Guid accountId,
        Guid? categoryId,
        string? reference,
        string? notes,
        string updatedBy)
    {
        Date = date;
        Description = description.Trim();
        Amount = amount;
        Type = type;
        AccountId = accountId;
        CategoryId = categoryId;
        Reference = reference?.Trim();
        Notes = notes?.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void AttachReceipt(Guid receiptId)
    {
        ReceiptId = receiptId;
    }

    public void DetachReceipt()
    {
        ReceiptId = null;
    }
}
