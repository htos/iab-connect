using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-071: Concurrency-safe invoice number counter.
/// One row per FinanceProfile + FiscalYear combination.
/// Uses PostgreSQL row-level locking via UPSERT for race-condition-free numbering.
/// </summary>
public class InvoiceNumberCounter : Entity
{
    public Guid FinanceProfileId { get; private set; }
    public int FiscalYear { get; private set; }
    public string Prefix { get; private set; } = string.Empty;
    public int CurrentValue { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private InvoiceNumberCounter() { }

    public static InvoiceNumberCounter Create(Guid financeProfileId, int fiscalYear, string prefix)
    {
        if (string.IsNullOrWhiteSpace(prefix))
            throw new ArgumentException("Prefix is required.", nameof(prefix));

        return new InvoiceNumberCounter
        {
            FinanceProfileId = financeProfileId,
            FiscalYear = fiscalYear,
            Prefix = prefix,
            CurrentValue = 0,
            UpdatedAt = DateTimeOffset.UtcNow
        };
    }

    /// <summary>
    /// Increments the counter and returns the formatted invoice number.
    /// This should only be called within a row-level lock context.
    /// </summary>
    public string GetNextNumber()
    {
        CurrentValue++;
        UpdatedAt = DateTimeOffset.UtcNow;
        return $"{Prefix}{CurrentValue:D4}";
    }

    /// <summary>
    /// Initializes the counter to a specific value (for migration seeding).
    /// </summary>
    public void SeedValue(int value)
    {
        if (value < 0)
            throw new ArgumentOutOfRangeException(nameof(value), "Value must be non-negative.");

        CurrentValue = value;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
