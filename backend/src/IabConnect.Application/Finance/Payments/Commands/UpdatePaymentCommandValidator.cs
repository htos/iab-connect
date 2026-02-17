using FluentValidation;
using IabConnect.Domain.Finance;
// PaymentDirection validation added for REQ-040

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class UpdatePaymentCommandValidator : AbstractValidator<UpdatePaymentCommand>
{
    public UpdatePaymentCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Payment ID is required.");
        RuleFor(x => x.Date).NotEmpty().WithMessage("Payment date is required.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");

        RuleFor(x => x.Direction)
            .NotEmpty().WithMessage("Payment direction is required.")
            .Must(d => Enum.TryParse<PaymentDirection>(d, true, out _))
            .WithMessage("Invalid payment direction. Must be 'Income' or 'Expense'.");

        RuleFor(x => x.Method)
            .NotEmpty().WithMessage("Payment method is required.")
            .Must(m => Enum.TryParse<PaymentMethod>(m, true, out _))
            .WithMessage("Invalid payment method.");

        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
