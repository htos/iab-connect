using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class UpdateInvoiceCommandValidator : AbstractValidator<UpdateInvoiceCommand>
{
    public UpdateInvoiceCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Invoice ID is required.");
        RuleFor(x => x.Date).NotEmpty().WithMessage("Invoice date is required.");
        RuleFor(x => x.DueDate).NotEmpty().WithMessage("Due date is required.");

        RuleFor(x => x.RecipientType)
            .NotEmpty().WithMessage("Recipient type is required.")
            .Must(t => Enum.TryParse<RecipientType>(t, true, out _))
            .WithMessage("Invalid recipient type.");

        RuleFor(x => x.RecipientName)
            .NotEmpty().WithMessage("Recipient name is required.")
            .MaximumLength(300);

        RuleFor(x => x.Items).NotEmpty().WithMessage("At least one invoice item is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
