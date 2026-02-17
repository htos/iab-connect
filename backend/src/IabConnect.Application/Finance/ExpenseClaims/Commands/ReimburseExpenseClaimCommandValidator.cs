using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class ReimburseExpenseClaimCommandValidator : AbstractValidator<ReimburseExpenseClaimCommand>
{
    public ReimburseExpenseClaimCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Expense claim ID is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");

        RuleFor(x => x.Method)
            .NotEmpty().WithMessage("Payment method is required.")
            .Must(m => Enum.TryParse<PaymentMethod>(m, true, out _))
            .WithMessage("Invalid payment method.");
    }
}
