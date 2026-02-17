using FluentValidation;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class MarkPaymentAsPaidCommandValidator : AbstractValidator<MarkPaymentAsPaidCommand>
{
    public MarkPaymentAsPaidCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Payment ID is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
