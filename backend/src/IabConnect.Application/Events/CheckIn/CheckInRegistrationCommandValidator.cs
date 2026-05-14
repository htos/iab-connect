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

        // REQ-023 (E3.S2 Round-3 R3-H-S2-1): cap QrCodeToken length at the DB max (50 chars per
        // EventRegistrationConfiguration.HasMaxLength(50)). Without this cap the validator would
        // wave through a 1 MB attacker token, which then hits a DB constraint violation that
        // bubbles up as a 500 — a cheap DoS vector. Matching the DB cap turns megabyte tokens
        // into a clean 400 instead. The unique index on QrCodeToken already provides the lookup
        // performance guarantee that motivated the review's DB-index suggestion.
        When(x => !string.IsNullOrWhiteSpace(x.QrCodeToken), () =>
        {
            RuleFor(x => x.QrCodeToken!)
                .MaximumLength(50)
                .WithMessage("QrCodeToken must be at most 50 characters.");
        });
    }
}
