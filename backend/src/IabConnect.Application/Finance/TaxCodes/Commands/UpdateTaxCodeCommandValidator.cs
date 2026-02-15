using FluentValidation;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

public sealed class UpdateTaxCodeCommandValidator : AbstractValidator<UpdateTaxCodeCommand>
{
    public UpdateTaxCodeCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Id is required.");
        RuleFor(x => x.Code).NotEmpty().MaximumLength(20).WithMessage("Code is required (max 20 chars).");
        RuleFor(x => x.Label).NotEmpty().MaximumLength(100).WithMessage("Label is required (max 100 chars).");
        RuleFor(x => x.Rate).InclusiveBetween(0m, 1m).WithMessage("Rate must be between 0 and 1.");
    }
}
