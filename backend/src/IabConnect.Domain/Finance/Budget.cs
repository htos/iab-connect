using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-044 (E6-S1): A planned budget amount for a cost center (<see cref="ActivityArea"/>)
/// within a single <see cref="FiscalPeriod"/>. The actuals side is the existing
/// <c>ActivityAreaId</c> already carried by transactions / invoice items / journal lines;
/// this entity supplies the "Soll" (planned) half for the Soll/Ist report (E6-S3).
/// </summary>
public class Budget : Entity, ISoftDeletable
{
    public Guid ActivityAreaId { get; private set; }
    public Guid FiscalPeriodId { get; private set; }
    public decimal Amount { get; private set; }
    public FinanceCurrency Currency { get; private set; }
    public string? Notes { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public string? CreatedBy { get; private set; }
    public DateTimeOffset? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }

    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private Budget() { }

    public static Budget Create(
        Guid activityAreaId,
        Guid fiscalPeriodId,
        decimal amount,
        FinanceCurrency currency,
        string? notes,
        string? createdBy)
    {
        if (activityAreaId == Guid.Empty)
            throw new ArgumentException("ActivityAreaId is required.", nameof(activityAreaId));
        if (fiscalPeriodId == Guid.Empty)
            throw new ArgumentException("FiscalPeriodId is required.", nameof(fiscalPeriodId));
        if (amount < 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "Budget amount must not be negative.");

        return new Budget
        {
            ActivityAreaId = activityAreaId,
            FiscalPeriodId = fiscalPeriodId,
            Amount = amount,
            Currency = currency,
            Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim(),
            CreatedAt = DateTimeOffset.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(decimal amount, FinanceCurrency currency, string? notes, string? updatedBy)
    {
        if (amount < 0)
            throw new ArgumentOutOfRangeException(nameof(amount), "Budget amount must not be negative.");

        Amount = amount;
        Currency = currency;
        Notes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
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
