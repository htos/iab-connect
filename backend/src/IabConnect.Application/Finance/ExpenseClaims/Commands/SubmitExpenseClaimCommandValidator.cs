using FluentValidation;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class SubmitExpenseClaimCommandValidator : AbstractValidator<SubmitExpenseClaimCommand>
{
    public SubmitExpenseClaimCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Expense claim ID is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
