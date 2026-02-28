using FluentValidation;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class MarkInvoiceAsOverdueCommandValidator : AbstractValidator<MarkInvoiceAsOverdueCommand>
{
    public MarkInvoiceAsOverdueCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty();
    }
}
