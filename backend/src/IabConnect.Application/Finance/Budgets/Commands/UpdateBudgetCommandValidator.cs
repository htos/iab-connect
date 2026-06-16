using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Budgets.Commands;

public sealed class UpdateBudgetCommandValidator : AbstractValidator<UpdateBudgetCommand>
{
    public UpdateBudgetCommandValidator()
    {
        RuleFor(x => x.Id)
            .NotEmpty().WithMessage("Budget id is required.");

        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(0).WithMessage("Budget amount must not be negative.");

        RuleFor(x => x.Currency)
            .Must(c => Enum.TryParse<FinanceCurrency>(c, true, out _))
            .When(x => !string.IsNullOrWhiteSpace(x.Currency))
            .WithMessage("Invalid currency.");

        RuleFor(x => x.Notes)
            .MaximumLength(500).WithMessage("Notes must not exceed 500 characters.");

        RuleFor(x => x.UserName)
            .NotEmpty().WithMessage("UserName is required.");
    }
}
