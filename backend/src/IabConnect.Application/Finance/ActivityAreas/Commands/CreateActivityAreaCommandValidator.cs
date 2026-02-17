using FluentValidation;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

public sealed class CreateActivityAreaCommandValidator : AbstractValidator<CreateActivityAreaCommand>
{
    public CreateActivityAreaCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).WithMessage("Name is required (max 200 chars).");
        RuleFor(x => x.Code).NotEmpty().MaximumLength(50).WithMessage("Code is required (max 50 chars).");
        RuleFor(x => x.Description).MaximumLength(500).WithMessage("Description must not exceed 500 characters.");
        RuleFor(x => x.Color).MaximumLength(7).WithMessage("Color must be a valid hex code (max 7 chars).");
    }
}
