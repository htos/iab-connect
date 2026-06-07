using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;

namespace IabConnect.Application.Communication.Automations;

/// <summary>REQ-028 (E5-S1): trigger projection (type + parameters).</summary>
public sealed record AutomationTriggerDto(AutomationTriggerType Type, int? OffsetDays);

/// <summary>REQ-028 (E5-S1): list-row projection of an automation definition.</summary>
public sealed record AutomationListItemDto(
    Guid Id,
    string Name,
    AutomationStatus Status,
    AutomationTriggerDto Trigger,
    int TemplateId,
    string? TemplateName,
    RecipientSegmentType SegmentType,
    ConsentType? ConsentFilter,
    string CreatedByName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

/// <summary>REQ-028 (E5-S1): full detail projection of an automation definition.</summary>
public sealed record AutomationDetailDto(
    Guid Id,
    string Name,
    string? Description,
    AutomationStatus Status,
    AutomationTriggerDto Trigger,
    int TemplateId,
    string? TemplateName,
    RecipientSegmentType SegmentType,
    string? SegmentFilter,
    ConsentType? ConsentFilter,
    Guid CreatedById,
    string CreatedByName,
    DateTime CreatedAt,
    DateTime? UpdatedAt);

/// <summary>REQ-028 (E5-S1): recipient-preview projection (count + bounded sample).</summary>
public sealed record RecipientPreviewDto(
    int TotalCount,
    IReadOnlyList<RecipientSampleDto> Preview);

public sealed record RecipientSampleDto(
    Guid? MemberId,
    string Email,
    string? FirstName,
    string? LastName);

/// <summary>
/// REQ-028 (E5-S1): shared mapping from the <see cref="AutomationDefinition"/> aggregate to its
/// DTOs. <c>templateName</c> is resolved by the caller (handler) from <see cref="IEmailTemplateRepository"/>.
/// </summary>
public static class AutomationMapping
{
    public static AutomationListItemDto ToListItem(AutomationDefinition d, string? templateName) => new(
        d.Id,
        d.Name,
        d.Status,
        new AutomationTriggerDto(d.Trigger.Type, d.Trigger.OffsetDays),
        d.TemplateId,
        templateName,
        d.SegmentType,
        d.ConsentFilter,
        d.CreatedByName,
        d.CreatedAt,
        d.UpdatedAt);

    public static AutomationDetailDto ToDetail(AutomationDefinition d, string? templateName) => new(
        d.Id,
        d.Name,
        d.Description,
        d.Status,
        new AutomationTriggerDto(d.Trigger.Type, d.Trigger.OffsetDays),
        d.TemplateId,
        templateName,
        d.SegmentType,
        d.SegmentFilter,
        d.ConsentFilter,
        d.CreatedById,
        d.CreatedByName,
        d.CreatedAt,
        d.UpdatedAt);
}
