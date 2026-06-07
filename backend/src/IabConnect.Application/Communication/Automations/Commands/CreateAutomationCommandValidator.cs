using FluentValidation;
using IabConnect.Application.Communication;
using IabConnect.Domain.Members;

namespace IabConnect.Application.Communication.Automations.Commands;

/// <summary>REQ-028 (E5-S1, AC-4): validator for <see cref="CreateAutomationCommand"/>.</summary>
public sealed class CreateAutomationCommandValidator : AbstractValidator<CreateAutomationCommand>
{
    public CreateAutomationCommandValidator(
        IEmailTemplateRepository templates,
        IMemberSegmentRepository segments)
    {
        AutomationValidationRules.AddCommonRules(
            this, templates, segments,
            x => x.Name,
            x => x.TemplateId,
            x => x.TriggerType,
            x => x.OffsetDays,
            x => x.SegmentType,
            x => x.SegmentFilter);

        RuleFor(x => x.CreatedByName).NotEmpty().WithMessage("CreatedByName is required.");
    }
}
