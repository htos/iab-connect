using FluentValidation;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed class ImportBankFileCommandValidator : AbstractValidator<ImportBankFileCommand>
{
    public ImportBankFileCommandValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().WithMessage("File name is required.");
        RuleFor(x => x.Rows).NotEmpty().WithMessage("At least one row is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
