using IabConnect.Application.Audit;
using IabConnect.Application.Communication;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Commands;

public sealed class UpdateAutomationCommandHandler : IRequestHandler<UpdateAutomationCommand, AutomationDetailDto?>
{
    private readonly IAutomationDefinitionRepository _repository;
    private readonly IEmailTemplateRepository _templates;
    private readonly IAuditService _auditService;

    public UpdateAutomationCommandHandler(
        IAutomationDefinitionRepository repository,
        IEmailTemplateRepository templates,
        IAuditService auditService)
    {
        _repository = repository;
        _templates = templates;
        _auditService = auditService;
    }

    public async Task<AutomationDetailDto?> Handle(UpdateAutomationCommand request, CancellationToken ct)
    {
        var definition = await _repository.GetByIdAsync(request.Id, ct);
        if (definition is null)
            return null;

        var trigger = AutomationTrigger.Create(request.TriggerType, request.OffsetDays);

        definition.Update(
            request.Name,
            request.Description,
            request.TemplateId,
            trigger,
            request.SegmentType,
            request.SegmentFilter,
            request.ConsentFilter);

        await _repository.UpdateAsync(definition, ct);

        await _auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Automation '{definition.Name}' updated",
            entityType: "AutomationDefinition",
            entityId: definition.Id.ToString(),
            ct: ct);

        var templateName = (await _templates.GetByIdAsync(definition.TemplateId))?.Name;
        return AutomationMapping.ToDetail(definition, templateName);
    }
}
