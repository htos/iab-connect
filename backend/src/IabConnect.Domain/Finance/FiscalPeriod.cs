using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-066: Represents a fiscal period (monthly) within a fiscal year.
/// Periods can be locked to prevent mutations on transactions/invoices/payments within that date range.
/// </summary>
public class FiscalPeriod : Entity
{
    public string Name { get; private set; } = string.Empty;       // e.g. "2026-01" or "January 2026"
    public int Year { get; private set; }                           // Fiscal year
    public int Month { get; private set; }                          // 1-12
    public DateTime StartDate { get; private set; }                 // First day of period
    public DateTime EndDate { get; private set; }                   // Last day of period
    public FiscalPeriodStatus Status { get; private set; } = FiscalPeriodStatus.Open;

    public DateTime? LockedAt { get; private set; }
    public string? LockedBy { get; private set; }
    public DateTime? UnlockedAt { get; private set; }
    public string? UnlockedBy { get; private set; }
    public string? LockNotes { get; private set; }

    // Balance carry-forward fields (populated on Close)
    public decimal? TotalIncome { get; private set; }
    public decimal? TotalExpense { get; private set; }
    public decimal? ClosingBalance { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private FiscalPeriod() { }

    public static FiscalPeriod Create(int year, int month, DateTime startDate, DateTime endDate)
    {
        if (month < 1 || month > 12)
            throw new ArgumentOutOfRangeException(nameof(month), "Month must be between 1 and 12.");
        if (endDate <= startDate)
            throw new ArgumentException("End date must be after start date.", nameof(endDate));

        var now = DateTimeOffset.UtcNow;
        return new FiscalPeriod
        {
            Year = year,
            Month = month,
            Name = $"{year}-{month:D2}",
            StartDate = DateTime.SpecifyKind(startDate, DateTimeKind.Utc),
            EndDate = DateTime.SpecifyKind(endDate, DateTimeKind.Utc),
            Status = FiscalPeriodStatus.Open,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    /// <summary>
    /// Lock the period. After locking, no transaction/invoice/payment mutations are allowed
    /// for dates within this period.
    /// </summary>
    public void Lock(string lockedBy, string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(lockedBy))
            throw new ArgumentException("LockedBy is required.", nameof(lockedBy));
        if (Status == FiscalPeriodStatus.Locked)
            throw new InvalidOperationException("Period is already locked.");

        Status = FiscalPeriodStatus.Locked;
        LockedAt = DateTime.UtcNow;
        LockedBy = lockedBy;
        LockNotes = notes?.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Unlock the period. Only admin can do this. Resets to Open status.
    /// </summary>
    public void Unlock(string unlockedBy)
    {
        if (string.IsNullOrWhiteSpace(unlockedBy))
            throw new ArgumentException("UnlockedBy is required.", nameof(unlockedBy));
        if (Status != FiscalPeriodStatus.Locked)
            throw new InvalidOperationException("Period is not locked.");

        Status = FiscalPeriodStatus.Open;
        UnlockedAt = DateTime.UtcNow;
        UnlockedBy = unlockedBy;
        LockNotes = null;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Close the period (soft close — warning only, still editable by admin).
    /// Stores financial totals for balance carry-forward.
    /// </summary>
    public void Close(string closedBy, decimal totalIncome, decimal totalExpense, string? notes = null)
    {
        if (string.IsNullOrWhiteSpace(closedBy))
            throw new ArgumentException("ClosedBy is required.", nameof(closedBy));
        if (Status == FiscalPeriodStatus.Locked)
            throw new InvalidOperationException("Cannot close a locked period. Unlock first.");

        TotalIncome = totalIncome;
        TotalExpense = totalExpense;
        ClosingBalance = totalIncome - totalExpense;

        Status = FiscalPeriodStatus.Closed;
        LockedAt = DateTime.UtcNow;
        LockedBy = closedBy;
        LockNotes = notes?.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Reopen a closed period. Clears the stored closing balance.
    /// </summary>
    public void Reopen(string reopenedBy)
    {
        if (Status != FiscalPeriodStatus.Closed)
            throw new InvalidOperationException("Only closed periods can be reopened.");

        Status = FiscalPeriodStatus.Open;
        TotalIncome = null;
        TotalExpense = null;
        ClosingBalance = null;
        UnlockedAt = DateTime.UtcNow;
        UnlockedBy = reopenedBy;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Check if a given date falls within this period.
    /// </summary>
    public bool ContainsDate(DateTime date)
    {
        var utcDate = DateTime.SpecifyKind(date.Date, DateTimeKind.Utc);
        return utcDate >= StartDate && utcDate <= EndDate;
    }

    /// <summary>
    /// Check if mutations are allowed in this period.
    /// </summary>
    public bool IsMutationAllowed => Status != FiscalPeriodStatus.Locked;
}
