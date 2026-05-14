using Hangfire;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Domain.Common;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Finance.Jobs;

/// <summary>
/// Hangfire wrapper for the MarkInvoicesOverdue background job.
/// Runs daily. Idempotent and safe to retry.
/// </summary>
public sealed class MarkInvoicesOverdueJob
{
    private readonly IMarkInvoicesOverdueService _service;
    private readonly IModuleSettingsService _moduleSettings;
    private readonly ILogger<MarkInvoicesOverdueJob> _logger;

    public MarkInvoicesOverdueJob(
        IMarkInvoicesOverdueService service,
        IModuleSettingsService moduleSettings,
        ILogger<MarkInvoicesOverdueJob> logger)
    {
        _service = service;
        _moduleSettings = moduleSettings;
        _logger = logger;
    }

    [AutomaticRetry(Attempts = 3)]
    [JobDisplayName("Mark Overdue Invoices")]
    public async Task ExecuteAsync(CancellationToken cancellationToken)
    {
        // REQ-087 (E10-S5): a disabled module's background jobs no-op cleanly — no
        // exceptions, no side effects — while the Finance module is switched off.
        if (!await _moduleSettings.IsEnabledAsync(ModuleKeys.Finance, cancellationToken))
        {
            _logger.LogInformation(
                "MarkInvoicesOverdueJob: skipped — the Finance module is disabled");
            return;
        }

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
