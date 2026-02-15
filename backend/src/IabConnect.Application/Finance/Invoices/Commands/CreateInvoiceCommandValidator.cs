using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class CreateInvoiceCommandValidator : AbstractValidator<CreateInvoiceCommand>
{
    public CreateInvoiceCommandValidator()
    {
        RuleFor(x => x.Date).NotEmpty().WithMessage("Invoice date is required.");
        RuleFor(x => x.DueDate).NotEmpty().WithMessage("Due date is required.");

        RuleFor(x => x.RecipientType)
            .NotEmpty().WithMessage("Recipient type is required.")
            .Must(t => Enum.TryParse<RecipientType>(t, true, out _))
            .WithMessage("Invalid recipient type.");

        RuleFor(x => x.RecipientName)
            .NotEmpty().WithMessage("Recipient name is required.")
            .MaximumLength(300).WithMessage("Recipient name must not exceed 300 characters.");

        RuleFor(x => x.Items)
            .NotEmpty().WithMessage("At least one invoice item is required.");

        RuleForEach(x => x.Items).ChildRules(item =>
        {
            item.RuleFor(i => i.Description).NotEmpty().WithMessage("Item description is required.");
            item.RuleFor(i => i.Quantity).GreaterThan(0).WithMessage("Item quantity must be greater than zero.");
            item.RuleFor(i => i.UnitPrice).GreaterThanOrEqualTo(0).WithMessage("Unit price must be non-negative.");
        });

        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
