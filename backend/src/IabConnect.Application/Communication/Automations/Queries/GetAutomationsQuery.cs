using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Communication;
using IabConnect.Domain.Communication;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Queries;

/// <summary>REQ-028 (E5-S1): paged + filtered list of automation definitions.</summary>
public sealed record GetAutomationsQuery : IRequest<PagedResult<AutomationListItemDto>>
{
    public string? Search { get; init; }
    public AutomationStatus? Status { get; init; }
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
}

public sealed class GetAutomationsQueryHandler
    : IRequestHandler<GetAutomationsQuery, PagedResult<AutomationListItemDto>>
{
    private readonly IAutomationDefinitionRepository _repository;
    private readonly IEmailTemplateRepository _templates;

    public GetAutomationsQueryHandler(
        IAutomationDefinitionRepository repository,
        IEmailTemplateRepository templates)
    {
        _repository = repository;
        _templates = templates;
    }

    public async Task<PagedResult<AutomationListItemDto>> Handle(GetAutomationsQuery request, CancellationToken ct)
    {
        var filter = new AutomationDefinitionFilterOptions
        {
            SearchTerm = request.Search,
            Status = request.Status
        };

        var (items, totalCount) = await _repository.GetAllAsync(filter, request.Page, request.PageSize, ct);

        // Resolve template names in one lookup so the list shows the template column without N queries.
        var templateNames = (await _templates.GetAllAsync(activeOnly: false))
            .ToDictionary(t => t.Id, t => t.Name);

        var dtos = items
            .Select(d => AutomationMapping.ToListItem(
                d, templateNames.TryGetValue(d.TemplateId, out var name) ? name : null))
            .ToList();

        return new PagedResult<AutomationListItemDto>
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = request.Page,
            PageSize = request.PageSize
        };
    }
}
