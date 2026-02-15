using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-042: Dunning notice (Mahnung) for overdue invoices.
/// </summary>
public class DunningNotice : Entity, ISoftDeletable
{
    public Guid InvoiceId { get; private set; }
    public Invoice Invoice { get; private set; } = null!;
    public int Level { get; private set; } = 1;
    public DateTime Date { get; private set; }
    public DateTime DueDate { get; private set; }
    public DunningStatus Status { get; private set; } = DunningStatus.Created;
    public DateTime? SentAt { get; private set; }
    public string? Notes { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private DunningNotice() { }

    public static DunningNotice Create(
        Guid invoiceId,
        int level,
        DateTime dueDate,
        string? notes,
        string createdBy)
    {
        if (level is < 1 or > 3)
            throw new ArgumentException("Dunning level must be between 1 and 3.", nameof(level));

        return new DunningNotice
        {
            InvoiceId = invoiceId,
            Level = level,
            Date = DateTime.UtcNow,
            DueDate = DateTime.SpecifyKind(dueDate, DateTimeKind.Utc),
            Notes = notes?.Trim(),
            CreatedBy = createdBy
        };
    }

    public void MarkAsSent()
    {
        Status = DunningStatus.Sent;
        SentAt = DateTime.UtcNow;
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
