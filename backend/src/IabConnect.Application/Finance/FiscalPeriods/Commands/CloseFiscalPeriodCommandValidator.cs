using FluentValidation;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class CloseFiscalPeriodCommandValidator : AbstractValidator<CloseFiscalPeriodCommand>
{
    public CloseFiscalPeriodCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty();
    }
}
