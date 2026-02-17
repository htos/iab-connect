using FluentValidation;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class UnlockFiscalPeriodCommandValidator : AbstractValidator<UnlockFiscalPeriodCommand>
{
    public UnlockFiscalPeriodCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty();
    }
}
