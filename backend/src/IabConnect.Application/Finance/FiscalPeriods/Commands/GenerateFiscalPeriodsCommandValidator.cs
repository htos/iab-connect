using FluentValidation;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class GenerateFiscalPeriodsCommandValidator : AbstractValidator<GenerateFiscalPeriodsCommand>
{
    public GenerateFiscalPeriodsCommandValidator()
    {
        RuleFor(x => x.Year).InclusiveBetween(2000, 2100);
        RuleFor(x => x.UserName).NotEmpty();
    }
}
