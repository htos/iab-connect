using FluentValidation;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class RejectExpenseClaimCommandValidator : AbstractValidator<RejectExpenseClaimCommand>
{
    public RejectExpenseClaimCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Expense claim ID is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Rejection reason is required.");
    }
}
