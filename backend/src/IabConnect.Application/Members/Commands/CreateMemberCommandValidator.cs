using FluentValidation;

namespace IabConnect.Application.Members.Commands;

public sealed class CreateMemberCommandValidator : AbstractValidator<CreateMemberCommand>
{
    public CreateMemberCommandValidator()
    {
        RuleFor(x => x.FirstName)
            .NotEmpty().WithMessage("Vorname ist erforderlich")
            .MaximumLength(100).WithMessage("Vorname darf maximal 100 Zeichen lang sein");

        RuleFor(x => x.LastName)
            .NotEmpty().WithMessage("Nachname ist erforderlich")
            .MaximumLength(100).WithMessage("Nachname darf maximal 100 Zeichen lang sein");

        RuleFor(x => x.Email)
            .NotEmpty().WithMessage("E-Mail ist erforderlich")
            .EmailAddress().WithMessage("Ungültige E-Mail-Adresse")
            .MaximumLength(255).WithMessage("E-Mail darf maximal 255 Zeichen lang sein");

        RuleFor(x => x.Phone)
            .MaximumLength(30).WithMessage("Telefonnummer darf maximal 30 Zeichen lang sein")
            .When(x => !string.IsNullOrEmpty(x.Phone));

        RuleFor(x => x.Street)
            .NotEmpty().WithMessage("Strasse ist erforderlich")
            .MaximumLength(200).WithMessage("Strasse darf maximal 200 Zeichen lang sein");

        RuleFor(x => x.City)
            .NotEmpty().WithMessage("Stadt ist erforderlich")
            .MaximumLength(100).WithMessage("Stadt darf maximal 100 Zeichen lang sein");

        RuleFor(x => x.PostalCode)
            .NotEmpty().WithMessage("PLZ ist erforderlich")
            .MaximumLength(20).WithMessage("PLZ darf maximal 20 Zeichen lang sein");

        RuleFor(x => x.Country)
            .NotEmpty().WithMessage("Land ist erforderlich")
            .MaximumLength(100).WithMessage("Land darf maximal 100 Zeichen lang sein");

        RuleFor(x => x.MembershipType)
            .IsInEnum().WithMessage("Ungültiger Mitgliedschaftstyp");
    }
}
