using FluentValidation;

namespace IabConnect.Application.Members.Commands;

/// <summary>
/// REQ-018 (E2.S3): syntactic validation for <see cref="MergeMembersCommand"/>.
/// Domain blocker logic (invoice/expense-claim status, Keycloak conflict, etc.) lives in the
/// handler — validators are synchronous and cannot reach the repository.
/// </summary>
public sealed class MergeMembersCommandValidator : AbstractValidator<MergeMembersCommand>
{
    public MergeMembersCommandValidator()
    {
        RuleFor(x => x.SourceId)
            .NotEqual(Guid.Empty).WithMessage("SourceId must be a non-empty GUID.");

        RuleFor(x => x.TargetId)
            .NotEqual(Guid.Empty).WithMessage("TargetId must be a non-empty GUID.");

        RuleFor(x => x)
            .Must(c => c.SourceId != c.TargetId)
            .WithMessage("SourceId and TargetId must differ.");

        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Reason is required.")
            .MaximumLength(500).WithMessage("Reason cannot exceed 500 characters.");

        RuleFor(x => x.AdminUserId)
            .NotEqual(Guid.Empty).WithMessage("AdminUserId must be a non-empty GUID.");
    }
}
