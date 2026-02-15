using FluentValidation;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class CancelInvoiceCommandValidator : AbstractValidator<CancelInvoiceCommand>
{
    public CancelInvoiceCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Invoice ID is required.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Cancellation reason is required.");
        RuleFor(x => x.AccountId).NotEmpty().WithMessage("Account ID for storno transaction is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
