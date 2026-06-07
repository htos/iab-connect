using FluentValidation;
using IabConnect.Application.Communication;
using IabConnect.Domain.Members;

namespace IabConnect.Application.Communication.Automations.Commands;

/// <summary>REQ-028 (E5-S1, AC-4): validator for <see cref="UpdateAutomationCommand"/>.</summary>
public sealed class UpdateAutomationCommandValidator : AbstractValidator<UpdateAutomationCommand>
{
    public UpdateAutomationCommandValidator(
        IEmailTemplateRepository templates,
        IMemberSegmentRepository segments)
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Automation id is required.");

        AutomationValidationRules.AddCommonRules(
            this, templates, segments,
            x => x.Name,
            x => x.TemplateId,
            x => x.TriggerType,
            x => x.OffsetDays,
            x => x.SegmentType,
            x => x.SegmentFilter);
    }
}
