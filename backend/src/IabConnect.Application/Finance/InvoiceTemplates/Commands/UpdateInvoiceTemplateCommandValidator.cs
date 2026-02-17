using FluentValidation;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

public sealed class UpdateInvoiceTemplateCommandValidator : AbstractValidator<UpdateInvoiceTemplateCommand>
{
    public UpdateInvoiceTemplateCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty().WithMessage("Id is required.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).WithMessage("Name is required (max 200 chars).");
        RuleFor(x => x.TaxExemptionNote).MaximumLength(500).When(x => x.TaxExemptionNote is not null);
        RuleFor(x => x.ReverseChargeNote).MaximumLength(500).When(x => x.ReverseChargeNote is not null);
        RuleFor(x => x.DefaultPaymentTerms).MaximumLength(500).When(x => x.DefaultPaymentTerms is not null);
        RuleFor(x => x.LogoUrl).MaximumLength(500).When(x => x.LogoUrl is not null);
        RuleFor(x => x.HeaderText).MaximumLength(1000).When(x => x.HeaderText is not null);
        RuleFor(x => x.FooterText).MaximumLength(1000).When(x => x.FooterText is not null);
        RuleFor(x => x.LegalNotice).MaximumLength(1000).When(x => x.LegalNotice is not null);
        RuleFor(x => x.Language).NotEmpty().MaximumLength(5).WithMessage("Language is required (ISO 639-1, max 5 chars).");
    }
}
