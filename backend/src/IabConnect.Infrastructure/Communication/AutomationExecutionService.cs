using IabConnect.Application.Audit;
using IabConnect.Application.Communication;
using IabConnect.Application.Communication.Automations;
using IabConnect.Application.Communication.Messaging;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Email;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Communication;

/// <summary>
/// REQ-028 (E5-S2): the automation dispatch engine. For each Active definition it resolves
/// recipients (consent re-resolved now — AC-6), computes due trigger occurrences, de-dups via the
/// idempotency pre-check (+ unique-index backstop, AC-3), sends each fresh recipient their
/// templated message via the <b>single isolated send call</b> (<see cref="SendMessageAsync"/> — the
/// S4 swap point, DEC-4), and records an <see cref="AutomationExecution"/> with per-recipient
/// status. Per-recipient failures are caught + recorded and never abort the batch (AC-4).
/// </summary>
public sealed class AutomationExecutionService : IAutomationExecutionService
{
    private readonly IAutomationDefinitionRepository _definitions;
    private readonly IAutomationExecutionRepository _executions;
    private readonly IRecipientResolutionService _resolver;
    private readonly IEmailTemplateRepository _templates;
    private readonly IMessageDispatcher _dispatcher;
    private readonly IChannelPreferenceService _channelPreferences;
    private readonly IAuditService _auditService;
    private readonly AutomationTriggerEvaluator _evaluator;
    private readonly TimeProvider _timeProvider;
    private readonly SmtpSettings _smtp;
    private readonly ILogger<AutomationExecutionService> _logger;

    public AutomationExecutionService(
        IAutomationDefinitionRepository definitions,
        IAutomationExecutionRepository executions,
        IRecipientResolutionService resolver,
        IEmailTemplateRepository templates,
        IMessageDispatcher dispatcher,
        IChannelPreferenceService channelPreferences,
        IAuditService auditService,
        AutomationTriggerEvaluator evaluator,
        TimeProvider timeProvider,
        IOptions<SmtpSettings> smtp,
        ILogger<AutomationExecutionService> logger)
    {
        _definitions = definitions;
        _executions = executions;
        _resolver = resolver;
        _templates = templates;
        _dispatcher = dispatcher;
        _channelPreferences = channelPreferences;
        _auditService = auditService;
        _evaluator = evaluator;
        _timeProvider = timeProvider;
        _smtp = smtp.Value;
        _logger = logger;
    }

    public async Task<int> ExecuteDueAsync(CancellationToken cancellationToken = default)
    {
        var nowUtc = _timeProvider.GetUtcNow().UtcDateTime;
        var active = await _definitions.GetActiveAsync(cancellationToken);
        if (active.Count == 0)
        {
            _logger.LogInformation("Automation dispatch: no active definitions");
            return 0;
        }

        var totalSent = 0;
        foreach (var definition in active)
        {
            cancellationToken.ThrowIfCancellationRequested();
            totalSent += await DispatchDefinitionAsync(definition, nowUtc, cancellationToken);
        }
        return totalSent;
    }

    private async Task<int> DispatchDefinitionAsync(
        AutomationDefinition definition, DateTime nowUtc, CancellationToken ct)
    {
        var recipients = await _resolver.ResolveAsync(
            definition.SegmentType, definition.SegmentFilter, definition.ConsentFilter, ct);

        var occurrences = _evaluator.ComputeDueOccurrences(definition, recipients, nowUtc);
        if (occurrences.Count == 0)
            return 0;

        // Idempotency pre-check (AC-3): drop occurrences already handled in a prior run.
        var existing = await _executions.ExistingRecipientKeysAsync(
            occurrences.Select(o => o.IdempotencyKey).ToList(), ct);
        var fresh = occurrences.Where(o => !existing.Contains(o.IdempotencyKey)).ToList();
        if (fresh.Count == 0)
        {
            _logger.LogInformation(
                "Automation dispatch: definition {DefinitionId} — all {Count} occurrence(s) already handled",
                definition.Id, occurrences.Count);
            return 0;
        }

        var template = await _templates.GetByIdAsync(definition.TemplateId);
        if (template is null)
        {
            _logger.LogWarning(
                "Automation dispatch: definition {DefinitionId} references missing template {TemplateId} — skipping",
                definition.Id, definition.TemplateId);
            return 0;
        }

        // AC-3 (idempotency, crash-safe): CLAIM-BEFORE-SEND. Build every fresh recipient as Pending
        // and persist the whole batch FIRST — this commits each unique IdempotencyKey before any
        // message goes out. If a crash/host-shutdown interrupts the send loop below, the Pending rows
        // are already on record, so a retry's pre-check skips them rather than re-sending (at-most-once;
        // a duplicate is structurally impossible). The unique index also makes the up-front insert the
        // single point where a rare concurrent-run collision surfaces — and because nothing has been
        // sent yet at that point, we can abandon the run safely (the other run owns these occurrences).
        var execution = AutomationExecution.Start(definition.Id);
        var pendingByKey = new Dictionary<string, (AutomationRecipient Recipient, DueOccurrence Occ)>();
        foreach (var occ in fresh)
        {
            var r = occ.Recipient;
            var recipient = AutomationRecipient.Pending(
                execution.Id, occ.IdempotencyKey, r.UserId, r.MemberId, r.Email ?? "", r.FirstName, r.LastName);
            execution.AddRecipient(recipient);
            pendingByKey[occ.IdempotencyKey] = (recipient, occ);
        }

        try
        {
            await _executions.AddAsync(execution, ct); // commit the Pending claims (+ unique keys) before sending
        }
        catch (DbUpdateException ex)
        {
            // A concurrent run already claimed one or more of these occurrences. Nothing has been
            // sent yet, so abandon this run — no duplicate, no orphaned send.
            _logger.LogWarning(ex,
                "Automation dispatch: definition {DefinitionId} — claim collided with a concurrent run; abandoning this pass",
                definition.Id);
            return 0;
        }

        foreach (var (recipient, occ) in pendingByKey.Values)
        {
            ct.ThrowIfCancellationRequested();
            var r = occ.Recipient;
            try
            {
                if (string.IsNullOrWhiteSpace(r.Email))
                {
                    recipient.MarkSkipped("Recipient has no email address");
                    continue;
                }

                var result = await SendMessageAsync(template, r, definition.ConsentFilter, ct);
                switch (result.Status)
                {
                    case MessageDeliveryStatus.Sent:
                        recipient.MarkSent(_timeProvider.GetUtcNow().UtcDateTime);
                        break;
                    case MessageDeliveryStatus.Skipped:
                        recipient.MarkSkipped(result.Reason ?? "skipped");
                        break;
                    default:
                        recipient.MarkFailed(result.Reason ?? "send failed");
                        break;
                }
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                // AC-4: a single bad recipient must not stop the rest of the batch.
                _logger.LogError(ex,
                    "Automation dispatch: send failed for definition {DefinitionId} recipient {Email}",
                    definition.Id, r.Email);
                recipient.MarkFailed(ex.Message);
            }
        }

        execution.Complete();
        await _executions.UpdateAsync(execution, ct); // persist the final per-recipient outcomes + counts

        // AC-6: an audit summary per execution so automated sends are reconstructable.
        await _auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Automation '{definition.Name}' dispatched: {execution.SentCount} sent, {execution.FailedCount} failed, {execution.SkippedCount} skipped",
            entityType: "AutomationExecution",
            entityId: execution.Id.ToString(),
            details: $"{{\"definitionId\":\"{definition.Id}\",\"sent\":{execution.SentCount},\"failed\":{execution.FailedCount},\"skipped\":{execution.SkippedCount}}}",
            ct: ct);

        _logger.LogInformation(
            "Automation dispatch: definition {DefinitionId} — {Sent} sent, {Failed} failed, {Skipped} skipped",
            definition.Id, execution.SentCount, execution.FailedCount, execution.SkippedCount);

        return execution.SentCount;
    }

    /// <summary>
    /// REQ-028 (E5-S2, DEC-4) / REQ-030 (E5-S4, DEC-3): the SINGLE per-recipient send call. S4 swapped
    /// it from a direct <c>IEmailSender</c> call to the channel-agnostic <see cref="IMessageDispatcher"/>
    /// (email is the default channel) — a contained change that does not touch the execution /
    /// idempotency logic above. Campaigns + event-notifications stay on <c>IEmailSender</c> (unchanged).
    /// </summary>
    private async Task<MessageSendResult> SendMessageAsync(
        EmailTemplate template, ResolvedRecipient recipient, Domain.Privacy.ConsentType? consentFilter, CancellationToken ct)
    {
        // REQ-030 (E5-S5): three-way eligibility (consent + preference + availability) decides the
        // channel. Null = the recipient is ineligible (e.g. consent revoked between resolution and
        // send) → record as Skipped, never sent on a wrong channel.
        var channel = await _channelPreferences.ResolveChannelAsync(
            recipient.UserId, MessageChannel.Email, consentFilter, ct);
        if (channel is null)
            return MessageSendResult.Skipped(MessageChannel.Email, "recipient not eligible (consent/preference/availability)");

        var vars = new Dictionary<string, string>
        {
            ["firstName"] = recipient.FirstName ?? "",
            ["lastName"] = recipient.LastName ?? "",
            ["email"] = recipient.Email,
            ["fullName"] = recipient.FullName
        };

        var subject = template.RenderSubject(vars);
        var html = template.RenderHtml(vars);
        var text = string.IsNullOrWhiteSpace(template.TextContent) ? null : RenderText(template.TextContent, vars);

        var request = new MessageRequest(
            channel.Value,
            recipient.Email,
            RecipientPhone: null,
            recipient.UserId,
            new MessageContent(subject, html, text),
            _smtp.FromName,
            _smtp.FromEmail);

        return await _dispatcher.DispatchAsync(request, ct);
    }

    private static string RenderText(string text, Dictionary<string, string> vars)
    {
        foreach (var (k, v) in vars)
            text = text.Replace($"{{{{{k}}}}}", v ?? "");
        return text;
    }
}
