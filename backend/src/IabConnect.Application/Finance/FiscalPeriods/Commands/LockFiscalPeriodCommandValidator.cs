using FluentValidation;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class LockFiscalPeriodCommandValidator : AbstractValidator<LockFiscalPeriodCommand>
{
    public LockFiscalPeriodCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty();
    }
}
