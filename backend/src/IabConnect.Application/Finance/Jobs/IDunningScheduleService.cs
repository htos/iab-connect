namespace IabConnect.Application.Finance.Jobs;

/// <summary>
/// REQ-042: Service to generate dunning notices for overdue invoices that lack a recent notice.
/// Designed for non-interactive (Hangfire) execution — idempotent & safe to retry.
/// </summary>
public interface IDunningScheduleService
{
    /// <summary>
    /// Finds all overdue invoices without a recent dunning notice and creates one for each.
    /// Returns the number of dunning notices created.
    /// </summary>
    Task<int> ExecuteAsync(CancellationToken ct = default);
}
