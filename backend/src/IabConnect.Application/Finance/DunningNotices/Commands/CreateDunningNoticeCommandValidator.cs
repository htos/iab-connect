using FluentValidation;

namespace IabConnect.Application.Finance.DunningNotices.Commands;

public sealed class CreateDunningNoticeCommandValidator : AbstractValidator<CreateDunningNoticeCommand>
{
    public CreateDunningNoticeCommandValidator()
    {
        RuleFor(x => x.InvoiceId).NotEmpty().WithMessage("Invoice ID is required.");
        RuleFor(x => x.Level).GreaterThan(0).WithMessage("Dunning level must be greater than zero.");
        RuleFor(x => x.DueDate).NotEmpty().WithMessage("Due date is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
