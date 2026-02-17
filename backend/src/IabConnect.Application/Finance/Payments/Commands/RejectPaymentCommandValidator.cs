using FluentValidation;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class RejectPaymentCommandValidator : AbstractValidator<RejectPaymentCommand>
{
    public RejectPaymentCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Payment ID is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
        RuleFor(x => x.Reason).NotEmpty().WithMessage("Rejection reason is required.");
    }
}
