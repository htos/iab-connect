using FluentValidation;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): Enforces the XOR rule on <see cref="CheckInRegistrationCommand"/> —
/// exactly one of <see cref="CheckInRegistrationCommand.RegistrationId"/> or
/// <see cref="CheckInRegistrationCommand.QrCodeToken"/> must be present.
/// </summary>
public sealed class CheckInRegistrationCommandValidator : AbstractValidator<CheckInRegistrationCommand>
{
    public CheckInRegistrationCommandValidator()
    {
        RuleFor(x => x.CheckedInBy)
            .NotEqual(Guid.Empty)
            .WithMessage("CheckedInBy must be a valid user id.");

        RuleFor(x => x)
            .Must(x => (x.RegistrationId is null) != (string.IsNullOrWhiteSpace(x.QrCodeToken)))
            .WithMessage("Exactly one of RegistrationId or QrCodeToken must be provided.");

        When(x => x.RegistrationId is not null, () =>
        {
            RuleFor(x => x.RegistrationId!.Value)
                .NotEqual(Guid.Empty)
                .WithMessage("RegistrationId must be a non-empty guid.");

            RuleFor(x => x.EventId)
                .NotEqual(Guid.Empty)
                .WithMessage("EventId is required for ID-based check-in.");
        });
    }
}
