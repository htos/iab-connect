using FluentValidation;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class ReviewExpenseClaimCommandValidator : AbstractValidator<ReviewExpenseClaimCommand>
{
    public ReviewExpenseClaimCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Expense claim ID is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
