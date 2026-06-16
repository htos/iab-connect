using IabConnect.Application.Audit;
using IabConnect.Application.Communication;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Commands;

/// <summary>REQ-028 (E5-S1): lifecycle transition commands. Each returns null when the id does not resolve;
/// an illegal transition throws <see cref="InvalidOperationException"/> → 409 via the exception middleware.</summary>
public sealed record ActivateAutomationCommand(Guid Id) : IRequest<AutomationDetailDto?>;
public sealed record PauseAutomationCommand(Guid Id) : IRequest<AutomationDetailDto?>;
public sealed record ResumeAutomationCommand(Guid Id) : IRequest<AutomationDetailDto?>;
public sealed record DisableAutomationCommand(Guid Id) : IRequest<AutomationDetailDto?>;

/// <summary>
/// Shared base for the four lifecycle handlers — load, apply the transition (a domain method that
/// guards itself), persist, audit, and project. The transition + the audit verb are the only
/// per-command difference.
/// </summary>
public abstract class AutomationLifecycleHandlerBase
{
    private readonly IAutomationDefinitionRepository _repository;
    private readonly IEmailTemplateRepository _templates;
    private readonly IAuditService _auditService;

    protected AutomationLifecycleHandlerBase(
        IAutomationDefinitionRepository repository,
        IEmailTemplateRepository templates,
        IAuditService auditService)
    {
        _repository = repository;
        _templates = templates;
        _auditService = auditService;
    }

    protected async Task<AutomationDetailDto?> TransitionAsync(
        Guid id, Action<AutomationDefinition> transition, string verb, CancellationToken ct)
    {
        var definition = await _repository.GetByIdAsync(id, ct);
        if (definition is null)
            return null;

        transition(definition);
        await _repository.UpdateAsync(definition, ct);

        await _auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Automation '{definition.Name}' {verb} (status now {definition.Status})",
            entityType: "AutomationDefinition",
            entityId: definition.Id.ToString(),
            ct: ct);

        var templateName = (await _templates.GetByIdAsync(definition.TemplateId))?.Name;
        return AutomationMapping.ToDetail(definition, templateName);
    }
}

public sealed class ActivateAutomationCommandHandler : AutomationLifecycleHandlerBase,
    IRequestHandler<ActivateAutomationCommand, AutomationDetailDto?>
{
    public ActivateAutomationCommandHandler(IAutomationDefinitionRepository r, IEmailTemplateRepository t, IAuditService a)
        : base(r, t, a) { }

    public Task<AutomationDetailDto?> Handle(ActivateAutomationCommand request, CancellationToken ct)
        => TransitionAsync(request.Id, d => d.Activate(), "activated", ct);
}

public sealed class PauseAutomationCommandHandler : AutomationLifecycleHandlerBase,
    IRequestHandler<PauseAutomationCommand, AutomationDetailDto?>
{
    public PauseAutomationCommandHandler(IAutomationDefinitionRepository r, IEmailTemplateRepository t, IAuditService a)
        : base(r, t, a) { }

    public Task<AutomationDetailDto?> Handle(PauseAutomationCommand request, CancellationToken ct)
        => TransitionAsync(request.Id, d => d.Pause(), "paused", ct);
}

public sealed class ResumeAutomationCommandHandler : AutomationLifecycleHandlerBase,
    IRequestHandler<ResumeAutomationCommand, AutomationDetailDto?>
{
    public ResumeAutomationCommandHandler(IAutomationDefinitionRepository r, IEmailTemplateRepository t, IAuditService a)
        : base(r, t, a) { }

    public Task<AutomationDetailDto?> Handle(ResumeAutomationCommand request, CancellationToken ct)
        => TransitionAsync(request.Id, d => d.Resume(), "resumed", ct);
}

public sealed class DisableAutomationCommandHandler : AutomationLifecycleHandlerBase,
    IRequestHandler<DisableAutomationCommand, AutomationDetailDto?>
{
    public DisableAutomationCommandHandler(IAutomationDefinitionRepository r, IEmailTemplateRepository t, IAuditService a)
        : base(r, t, a) { }

    public Task<AutomationDetailDto?> Handle(DisableAutomationCommand request, CancellationToken ct)
        => TransitionAsync(request.Id, d => d.Disable(), "disabled", ct);
}
