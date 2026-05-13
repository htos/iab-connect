using FluentValidation;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): Validation for the manual-search check-in command.
/// </summary>
public sealed class ManualCheckInRegistrationCommandValidator : AbstractValidator<ManualCheckInRegistrationCommand>
{
    public ManualCheckInRegistrationCommandValidator()
    {
        RuleFor(x => x.EventId)
            .NotEqual(Guid.Empty)
            .WithMessage("EventId is required.");

        RuleFor(x => x.RegistrationId)
            .NotEqual(Guid.Empty)
            .WithMessage("RegistrationId is required.");

        RuleFor(x => x.CheckedInBy)
            .NotEqual(Guid.Empty)
            .WithMessage("CheckedInBy must be a valid user id.");
    }
}
