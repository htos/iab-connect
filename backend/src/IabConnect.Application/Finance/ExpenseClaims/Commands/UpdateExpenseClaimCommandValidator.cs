using FluentValidation;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class UpdateExpenseClaimCommandValidator : AbstractValidator<UpdateExpenseClaimCommand>
{
    public UpdateExpenseClaimCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Expense claim ID is required.");
        RuleFor(x => x.Title).NotEmpty().WithMessage("Title is required.");
        RuleFor(x => x.Description).NotEmpty().WithMessage("Description is required.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");
        RuleFor(x => x.Date).NotEmpty().WithMessage("Date is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
