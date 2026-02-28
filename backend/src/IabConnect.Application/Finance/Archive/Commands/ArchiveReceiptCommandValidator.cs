using FluentValidation;

namespace IabConnect.Application.Finance.Archive.Commands;

public sealed class ArchiveReceiptCommandValidator : AbstractValidator<ArchiveReceiptCommand>
{
    public ArchiveReceiptCommandValidator()
    {
        RuleFor(x => x.ReceiptId).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.UserName).NotEmpty();
    }
}
