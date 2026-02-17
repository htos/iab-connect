using FluentValidation;

namespace IabConnect.Application.Finance.BankImports.Commands;

/// <summary>
/// REQ-069: Validator for camt import command.
/// </summary>
public sealed class ImportCamtCommandValidator : AbstractValidator<ImportCamtCommand>
{
    public ImportCamtCommandValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().WithMessage("File name is required.");
        RuleFor(x => x.FileStream).NotNull().WithMessage("File stream is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
        RuleFor(x => x.FileName)
            .Must(f => f.EndsWith(".xml", StringComparison.OrdinalIgnoreCase))
            .WithMessage("File must be an XML file.");
    }
}
