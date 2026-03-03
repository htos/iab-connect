using FluentValidation;

namespace IabConnect.Application.Sponsors.Commands;

public sealed class CreateSupplierCommandValidator : AbstractValidator<CreateSupplierCommand>
{
    public CreateSupplierCommandValidator()
    {
        RuleFor(x => x.CompanyName)
            .NotEmpty().WithMessage("Company name is required")
            .MaximumLength(200).WithMessage("Company name must not exceed 200 characters");

        RuleFor(x => x.ContactPerson)
            .MaximumLength(200).WithMessage("Contact person must not exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.ContactPerson));

        RuleFor(x => x.Email)
            .EmailAddress().WithMessage("Invalid email address")
            .MaximumLength(200).WithMessage("Email must not exceed 200 characters")
            .When(x => !string.IsNullOrEmpty(x.Email));

        RuleFor(x => x.Phone)
            .MaximumLength(50).WithMessage("Phone must not exceed 50 characters")
            .When(x => !string.IsNullOrEmpty(x.Phone));

        RuleFor(x => x.Website)
            .MaximumLength(500).WithMessage("Website must not exceed 500 characters")
            .When(x => !string.IsNullOrEmpty(x.Website));

        RuleFor(x => x.Category)
            .MaximumLength(100).WithMessage("Category must not exceed 100 characters")
            .When(x => !string.IsNullOrEmpty(x.Category));

        RuleFor(x => x.Notes)
            .MaximumLength(2000).WithMessage("Notes must not exceed 2000 characters")
            .When(x => !string.IsNullOrEmpty(x.Notes));
    }
}
