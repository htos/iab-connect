using Hangfire;
using IabConnect.Application.Finance.Jobs;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance.Jobs;

/// <summary>
/// Hangfire wrapper for the MarkInvoicesOverdue background job.
/// Runs daily. Idempotent and safe to retry.
/// </summary>
public sealed class MarkInvoicesOverdueJob
{
    private readonly IMarkInvoicesOverdueService _service;
    private readonly ILogger<MarkInvoicesOverdueJob> _logger;

    public MarkInvoicesOverdueJob(
        IMarkInvoicesOverdueService service,
        ILogger<MarkInvoicesOverdueJob> logger)
    {
        _service = service;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Mark Overdue Invoices")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("MarkInvoicesOverdueJob: Starting execution");

        try
        {
            var count = await _service.ExecuteAsync(cancellationToken);
            _logger.LogInformation("MarkInvoicesOverdueJob: Completed — {Count} invoice(s) marked overdue", count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "MarkInvoicesOverdueJob: Failed");
            throw; // let Hangfire retry
        }
    }
}
