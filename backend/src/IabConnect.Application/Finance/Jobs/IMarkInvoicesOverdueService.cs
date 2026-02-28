namespace IabConnect.Application.Finance.Jobs;

/// <summary>
/// REQ-039: Service to mark sent invoices past their due date as overdue.
/// Designed for non-interactive (Hangfire) execution — idempotent & safe to retry.
/// </summary>
public interface IMarkInvoicesOverdueService
{
    /// <summary>
    /// Finds all invoices with Status=Sent and DueDate &lt; today, marks them Overdue and persists.
    /// Returns the number of invoices that were transitioned.
    /// </summary>
    Task<int> ExecuteAsync(CancellationToken ct = default);
}
