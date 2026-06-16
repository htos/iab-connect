using IabConnect.Application.Communication;
using IabConnect.Domain.Communication;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Queries;

/// <summary>REQ-028 (E5-S1): single automation definition by id (null when not found).</summary>
public sealed record GetAutomationByIdQuery(Guid Id) : IRequest<AutomationDetailDto?>;

public sealed class GetAutomationByIdQueryHandler
    : IRequestHandler<GetAutomationByIdQuery, AutomationDetailDto?>
{
    private readonly IAutomationDefinitionRepository _repository;
    private readonly IEmailTemplateRepository _templates;

    public GetAutomationByIdQueryHandler(
        IAutomationDefinitionRepository repository,
        IEmailTemplateRepository templates)
    {
        _repository = repository;
        _templates = templates;
    }

    public async Task<AutomationDetailDto?> Handle(GetAutomationByIdQuery request, CancellationToken ct)
    {
        var definition = await _repository.GetByIdAsync(request.Id, ct);
        if (definition is null)
            return null;

        var templateName = (await _templates.GetByIdAsync(definition.TemplateId))?.Name;
        return AutomationMapping.ToDetail(definition, templateName);
    }
}
