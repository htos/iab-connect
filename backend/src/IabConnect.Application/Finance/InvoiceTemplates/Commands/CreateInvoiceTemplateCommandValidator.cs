using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

public sealed class CreateInvoiceTemplateCommandValidator : AbstractValidator<CreateInvoiceTemplateCommand>
{
    public CreateInvoiceTemplateCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200).WithMessage("Name is required (max 200 chars).");
        RuleFor(x => x.Jurisdiction).NotEmpty().Must(j => Enum.TryParse<Jurisdiction>(j, true, out _))
            .WithMessage("Jurisdiction must be a valid value (CH, EU).");
        RuleFor(x => x.CountryCode).MaximumLength(2).When(x => x.CountryCode is not null);
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
