using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Commands;

/// <summary>
/// REQ-028 (E5-S1): structural edit of an automation definition. Allowed only in Draft/Paused
/// (the domain method throws otherwise → 409 via the exception middleware). Returns null when the
/// id does not resolve.
/// </summary>
public sealed record UpdateAutomationCommand : IRequest<AutomationDetailDto?>
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public string? Description { get; init; }
    public required int TemplateId { get; init; }
    public required AutomationTriggerType TriggerType { get; init; }
    public int? OffsetDays { get; init; }
    public required RecipientSegmentType SegmentType { get; init; }
    public string? SegmentFilter { get; init; }
    public ConsentType? ConsentFilter { get; init; }
}
