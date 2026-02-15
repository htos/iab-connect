using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class CreatePaymentCommandValidator : AbstractValidator<CreatePaymentCommand>
{
    public CreatePaymentCommandValidator()
    {
        RuleFor(x => x.Date).NotEmpty().WithMessage("Payment date is required.");
        RuleFor(x => x.Amount).GreaterThan(0).WithMessage("Amount must be greater than zero.");

        RuleFor(x => x.Method)
            .NotEmpty().WithMessage("Payment method is required.")
            .Must(m => Enum.TryParse<PaymentMethod>(m, true, out _))
            .WithMessage("Invalid payment method.");

        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
