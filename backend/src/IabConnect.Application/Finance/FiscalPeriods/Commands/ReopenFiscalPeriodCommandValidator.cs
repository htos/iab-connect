using FluentValidation;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class ReopenFiscalPeriodCommandValidator : AbstractValidator<ReopenFiscalPeriodCommand>
{
    public ReopenFiscalPeriodCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.UserName).NotEmpty();
    }
}
