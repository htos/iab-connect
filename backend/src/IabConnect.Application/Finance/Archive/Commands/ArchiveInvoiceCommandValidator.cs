using FluentValidation;

namespace IabConnect.Application.Finance.Archive.Commands;

public sealed class ArchiveInvoiceCommandValidator : AbstractValidator<ArchiveInvoiceCommand>
{
    public ArchiveInvoiceCommandValidator()
    {
        RuleFor(x => x.InvoiceId).NotEmpty();
        RuleFor(x => x.Reason).NotEmpty().MaximumLength(1000);
        RuleFor(x => x.UserName).NotEmpty();
    }
}
