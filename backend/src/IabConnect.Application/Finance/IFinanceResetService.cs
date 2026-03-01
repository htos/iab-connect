namespace IabConnect.Application.Finance;

/// <summary>
/// Service to reset (delete) ALL finance data.
/// Implemented in Infrastructure using direct database access.
/// </summary>
public interface IFinanceResetService
{
    /// <summary>
    /// Deletes all finance data from the database.
    /// This is irreversible. Returns the number of tables cleared.
    /// </summary>
    Task<int> ResetAllFinanceDataAsync(CancellationToken ct = default);
}
