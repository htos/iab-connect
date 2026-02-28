using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-038: Financial transaction (Buchung) - income or expense entry.
/// REQ-062: Extended with optional tax code and tax breakdown.
/// REQ-070: Supports revision-safe archival (Swiss OR Art. 958f).
/// </summary>
public class Transaction : Entity, ISoftDeletable, IArchivable
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

    // REQ-068: Activity area tagging
    public Guid? ActivityAreaId { get; private set; }
    public ActivityArea? ActivityArea { get; private set; }

    // REQ-062: VAT fields
    public Guid? TaxCodeId { get; private set; }
    public decimal? TaxRate { get; private set; }
    public decimal? TaxAmount { get; private set; }
    public decimal? NetAmount { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    // REQ-070: Archive fields
    public bool IsArchived { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public string? ArchivedBy { get; private set; }
    public string? ArchiveReason { get; private set; }
    public DateTimeOffset RetainUntil { get; private set; }

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
        string createdBy,
        Guid? taxCodeId = null,
        decimal? taxRate = null,
        Guid? activityAreaId = null)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));
        if (amount <= 0)
            throw new ArgumentException("Amount must be positive.", nameof(amount));

        decimal? taxAmount = null;
        decimal? netAmount = null;
        if (taxRate.HasValue)
        {
            taxAmount = Math.Round(amount * taxRate.Value / (1 + taxRate.Value), 2);
            netAmount = amount - taxAmount.Value;
        }

        return new Transaction
        {
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            Description = description.Trim(),
            Amount = amount,
            Type = type,
            AccountId = accountId,
            CategoryId = categoryId,
            Reference = reference?.Trim(),
            Notes = notes?.Trim(),
            TaxCodeId = taxCodeId,
            TaxRate = taxRate,
            TaxAmount = taxAmount,
            NetAmount = netAmount,
            ActivityAreaId = activityAreaId,
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
        string updatedBy,
        Guid? taxCodeId = null,
        decimal? taxRate = null,
        Guid? activityAreaId = null)
    {
        Date = DateTime.SpecifyKind(date, DateTimeKind.Utc);
        Description = description.Trim();
        Amount = amount;
        Type = type;
        AccountId = accountId;
        CategoryId = categoryId;
        Reference = reference?.Trim();
        Notes = notes?.Trim();
        TaxCodeId = taxCodeId;
        TaxRate = taxRate;
        ActivityAreaId = activityAreaId;

        if (taxRate.HasValue)
        {
            TaxAmount = Math.Round(amount * taxRate.Value / (1 + taxRate.Value), 2);
            NetAmount = amount - TaxAmount.Value;
        }
        else
        {
            TaxAmount = null;
            NetAmount = null;
        }

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

    /// <summary>
    /// REQ-070: Archives the transaction, making it read-only.
    /// </summary>
    public void Archive(string archivedBy, string reason, DateTimeOffset retainUntil)
    {
        if (string.IsNullOrWhiteSpace(archivedBy))
            throw new ArgumentException("ArchivedBy is required.", nameof(archivedBy));
        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Archive reason is required.", nameof(reason));

        IsArchived = true;
        ArchivedAt = DateTimeOffset.UtcNow;
        ArchivedBy = archivedBy;
        ArchiveReason = reason.Trim();
        RetainUntil = retainUntil;
    }

    /// <summary>
    /// REQ-070: Restores the transaction from archive (Admin only).
    /// </summary>
    public void Restore(string restoredBy)
    {
        if (!IsArchived)
            throw new InvalidOperationException("Transaction is not archived.");

        IsArchived = false;
        ArchivedAt = null;
        ArchivedBy = null;
        ArchiveReason = null;
        RetainUntil = default;
    }
}
