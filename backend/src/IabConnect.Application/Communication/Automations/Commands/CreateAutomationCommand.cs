using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Commands;

/// <summary>
/// REQ-028 (E5-S1): create a new automation definition (starts in <see cref="AutomationStatus.Draft"/>).
/// </summary>
public sealed record CreateAutomationCommand : IRequest<AutomationDetailDto>
{
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required int TemplateId { get; init; }
    public required AutomationTriggerType TriggerType { get; init; }
    public int? OffsetDays { get; init; }
    public required RecipientSegmentType SegmentType { get; init; }
    public string? SegmentFilter { get; init; }
    public ConsentType? ConsentFilter { get; init; }

    public required Guid CreatedById { get; init; }
    public required string CreatedByName { get; init; }
}
