using FluentValidation;
using IabConnect.Application.Communication;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;

namespace IabConnect.Application.Communication.Automations.Commands;

/// <summary>
/// REQ-028 (E5-S1, AC-4): the shared validation rule-set for the create + update automation
/// commands. Both validators add the same rules via this helper so the per-field errors cannot
/// drift between create and edit. The repositories are supplied by the validator (constructor
/// injection) so the async template/segment checks read live data.
/// </summary>
internal static class AutomationValidationRules
{
    public static void AddCommonRules<T>(
        AbstractValidator<T> v,
        IEmailTemplateRepository templates,
        IMemberSegmentRepository segments,
        Func<T, string> name,
        Func<T, int> templateId,
        Func<T, AutomationTriggerType> triggerType,
        Func<T, int?> offsetDays,
        Func<T, RecipientSegmentType> segmentType,
        Func<T, string?> segmentFilter)
    {
        v.RuleFor(x => name(x))
            .NotEmpty().WithName("Name").WithMessage("Automation name is required.")
            .MaximumLength(200).WithName("Name").WithMessage("Automation name must not exceed 200 characters.");

        v.RuleFor(x => triggerType(x))
            .IsInEnum().WithName("TriggerType").WithMessage("Unsupported trigger type.");

        v.RuleFor(x => segmentType(x))
            .IsInEnum().WithName("SegmentType").WithMessage("Unsupported recipient segment type.");

        // Time-relative triggers (EventUpcoming / MembershipRenewalDue) require a non-negative offset.
        v.RuleFor(x => offsetDays(x))
            .Must(o => o.HasValue && o.Value >= 0)
            .When(x => AutomationTrigger.IsTimeRelative(triggerType(x)))
            .WithName("OffsetDays")
            .WithMessage("This trigger type requires a non-negative OffsetDays (days before the event/due date).");

        // TemplateId must resolve to an existing, active, non-deleted EmailTemplate.
        v.RuleFor(x => templateId(x))
            .MustAsync(async (id, ct) =>
            {
                var template = await templates.GetByIdAsync(id);
                return template is { IsActive: true, IsDeleted: false };
            })
            .WithName("TemplateId")
            .WithMessage("The selected email template does not exist or is not active.");

        // A MemberSegment recipient rule must reference a segment id that resolves.
        v.RuleFor(x => segmentFilter(x))
            .MustAsync(async (filter, ct) =>
                Guid.TryParse(filter, out var segmentId) && await segments.ExistsAsync(segmentId, ct))
            .When(x => segmentType(x) == RecipientSegmentType.MemberSegment)
            .WithName("SegmentFilter")
            .WithMessage("The recipient rule references a member segment that does not exist.");
    }
}
