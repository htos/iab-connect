using IabConnect.Domain.Communication;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Queries;

/// <summary>REQ-028 (E5-S3): recent dispatch runs for a definition (S3's recent-execution panel).</summary>
public sealed record GetAutomationExecutionsQuery(Guid DefinitionId, int Limit = 10)
    : IRequest<IReadOnlyList<AutomationExecutionDto>>;

public sealed record AutomationExecutionDto(
    Guid Id,
    AutomationExecutionStatus Status,
    DateTime StartedAt,
    DateTime? CompletedAt,
    int TotalRecipients,
    int SentCount,
    int FailedCount,
    int SkippedCount);

public sealed class GetAutomationExecutionsQueryHandler
    : IRequestHandler<GetAutomationExecutionsQuery, IReadOnlyList<AutomationExecutionDto>>
{
    private readonly IAutomationExecutionRepository _executions;

    public GetAutomationExecutionsQueryHandler(IAutomationExecutionRepository executions)
    {
        _executions = executions;
    }

    public async Task<IReadOnlyList<AutomationExecutionDto>> Handle(
        GetAutomationExecutionsQuery request, CancellationToken ct)
    {
        var runs = await _executions.GetRecentForDefinitionAsync(request.DefinitionId, request.Limit, ct);
        return runs
            .Select(e => new AutomationExecutionDto(
                e.Id, e.Status, e.StartedAt, e.CompletedAt,
                e.TotalRecipients, e.SentCount, e.FailedCount, e.SkippedCount))
            .ToList();
    }
}
