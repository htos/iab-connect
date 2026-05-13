using FluentValidation;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// REQ-018 (E2.S4): syntactic validation for <see cref="DismissDuplicateCandidateCommand"/>.
/// Domain checks (members exist, neither is merged-into) live in the handler.
/// </summary>
public sealed class DismissDuplicateCandidateCommandValidator : AbstractValidator<DismissDuplicateCandidateCommand>
{
    public DismissDuplicateCandidateCommandValidator()
    {
        RuleFor(x => x.MemberA)
            .NotEqual(Guid.Empty).WithMessage("MemberA must be a non-empty GUID.");

        RuleFor(x => x.MemberB)
            .NotEqual(Guid.Empty).WithMessage("MemberB must be a non-empty GUID.");

        RuleFor(x => x)
            .Must(c => c.MemberA != c.MemberB)
            .WithMessage("MemberA and MemberB must differ.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Reason is required.")
            .MaximumLength(500).WithMessage("Reason cannot exceed 500 characters.");

        RuleFor(x => x.DismissedByUserId)
            .NotEqual(Guid.Empty).WithMessage("DismissedByUserId must be a non-empty GUID.");
    }
}
