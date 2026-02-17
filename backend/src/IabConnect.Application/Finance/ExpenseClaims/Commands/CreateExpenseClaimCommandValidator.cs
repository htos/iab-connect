using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class CreateExpenseClaimCommandValidator : AbstractValidator<CreateExpenseClaimCommand>
{
    public CreateExpenseClaimCommandValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Title is required.");
        RuleFor(x => x.Description).NotEmpty().WithMessage("Description is required.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");

        RuleFor(x => x.Currency)
            .NotEmpty().WithMessage("Currency is required.")
            .Must(c => Enum.TryParse<FinanceCurrency>(c, true, out _))
            .WithMessage("Invalid currency.");

        RuleFor(x => x.Date).NotEmpty().WithMessage("Date is required.");
        RuleFor(x => x.ClaimantId).NotEmpty().WithMessage("Claimant ID is required.");
        RuleFor(x => x.ClaimantName).NotEmpty().WithMessage("Claimant name is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
