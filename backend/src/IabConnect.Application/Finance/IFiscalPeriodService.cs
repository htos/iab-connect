namespace IabConnect.Application.Finance;

/// <summary>
/// REQ-066: Service to check fiscal period locking before allowing mutations.
/// </summary>
public interface IFiscalPeriodService
{
    /// <summary>
    /// Checks if a mutation is allowed for the given date. Throws if period is locked.
    /// </summary>
    Task EnsurePeriodNotLockedAsync(DateTime date, CancellationToken ct = default);

    /// <summary>
    /// Returns true if the period containing the given date is locked.
    /// </summary>
    Task<bool> IsPeriodLockedAsync(DateTime date, CancellationToken ct = default);
}
