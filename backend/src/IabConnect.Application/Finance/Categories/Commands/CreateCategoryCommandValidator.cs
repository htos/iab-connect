using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Categories.Commands;

public sealed class CreateCategoryCommandValidator : AbstractValidator<CreateCategoryCommand>
{
    public CreateCategoryCommandValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Category name is required.")
            .MaximumLength(200).WithMessage("Category name must not exceed 200 characters.");

        RuleFor(x => x.Type)
            .NotEmpty().WithMessage("Transaction type is required.")
            .Must(t => Enum.TryParse<TransactionType>(t, true, out _))
            .WithMessage("Invalid transaction type.");

        RuleFor(x => x.Color)
            .NotEmpty().WithMessage("Color is required.");

        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
