using FluentValidation;
using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.FinanceProfiles.Commands;

public sealed class CreateFinanceProfileCommandValidator : AbstractValidator<CreateFinanceProfileCommand>
{
    public CreateFinanceProfileCommandValidator()
    {
        RuleFor(x => x.Jurisdiction).NotEmpty()
            .Must(v => Enum.TryParse<Jurisdiction>(v, false, out _))
            .WithMessage("Invalid jurisdiction. Valid values: CH, EU.");

        RuleFor(x => x.Currency).NotEmpty()
            .Must(v => Enum.TryParse<FinanceCurrency>(v, false, out _))
            .WithMessage("Invalid currency. Valid values: CHF, EUR.");

        RuleFor(x => x.FiscalYearStartMonth).InclusiveBetween(1, 12)
            .WithMessage("Fiscal year start month must be between 1 and 12.");

        RuleFor(x => x.OrganizationName).NotEmpty().MaximumLength(200);
        RuleFor(x => x.OrganizationAddress).NotEmpty().MaximumLength(500);
        RuleFor(x => x.OrganizationCity).NotEmpty().MaximumLength(100);
        RuleFor(x => x.OrganizationPostalCode).NotEmpty().MaximumLength(20);
        RuleFor(x => x.OrganizationCountry).NotEmpty().MaximumLength(100);

        When(x => x.VatStatus is not null, () =>
        {
            RuleFor(x => x.VatStatus)
                .Must(v => Enum.TryParse<VatStatus>(v, true, out _))
                .WithMessage("Invalid VAT status.");
        });
    }
}
