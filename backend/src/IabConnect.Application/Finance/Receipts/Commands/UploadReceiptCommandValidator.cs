using FluentValidation;

namespace IabConnect.Application.Finance.Receipts.Commands;

public sealed class UploadReceiptCommandValidator : AbstractValidator<UploadReceiptCommand>
{
    public UploadReceiptCommandValidator()
    {
        RuleFor(x => x.FileName).NotEmpty().WithMessage("File name is required.");
        RuleFor(x => x.ContentType).NotEmpty().WithMessage("Content type is required.");
        RuleFor(x => x.FileSize).GreaterThan(0).WithMessage("File must not be empty.");
        RuleFor(x => x.FileStream).NotNull().WithMessage("File stream is required.");
        RuleFor(x => x.UserName).NotEmpty().WithMessage("UserName is required.");
    }
}
