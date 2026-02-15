using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Accounts.Commands;

public sealed class UpdateAccountCommandValidator : AbstractValidator<UpdateAccountCommand>
{
    public UpdateAccountCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Account ID is required.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Account name is required.")
            .MaximumLength(200).WithMessage("Account name must not exceed 200 characters.");

        RuleFor(x => x.Number)
            .NotEmpty().WithMessage("Account number is required.")
            .MaximumLength(50).WithMessage("Account number must not exceed 50 characters.");

        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Account type is required.")
            .Must(t => Enum.TryParse<AccountType>(t, true, out _))
            .WithMessage("Invalid account type.");

        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
