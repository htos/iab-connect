using IabConnect.Application.Audit;
using IabConnect.Application.Communication;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Commands;

public sealed class CreateAutomationCommandHandler : IRequestHandler<CreateAutomationCommand, AutomationDetailDto>
{
    private readonly IAutomationDefinitionRepository _repository;
    private readonly IEmailTemplateRepository _templates;
    private readonly IAuditService _auditService;

    public CreateAutomationCommandHandler(
        IAutomationDefinitionRepository repository,
        IEmailTemplateRepository templates,
        IAuditService auditService)
    {
        _repository = repository;
        _templates = templates;
        _auditService = auditService;
    }

    public async Task<AutomationDetailDto> Handle(CreateAutomationCommand request, CancellationToken ct)
    {
        var trigger = AutomationTrigger.Create(request.TriggerType, request.OffsetDays);

        var definition = AutomationDefinition.Create(
            request.Name,
            request.Description,
            request.TemplateId,
            trigger,
            request.SegmentType,
            request.SegmentFilter,
            request.ConsentFilter,
            request.CreatedById,
            request.CreatedByName);

        await _repository.AddAsync(definition, ct);

        await _auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Automation '{definition.Name}' created",
            entityType: "AutomationDefinition",
            entityId: definition.Id.ToString(),
            ct: ct);

        var templateName = (await _templates.GetByIdAsync(definition.TemplateId))?.Name;
        return AutomationMapping.ToDetail(definition, templateName);
    }
}
