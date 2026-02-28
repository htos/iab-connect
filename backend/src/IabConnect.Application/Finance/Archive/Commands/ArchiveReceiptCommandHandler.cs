using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Archives a receipt with 10-year retention (Swiss OR Art. 958f).
/// </summary>
public sealed class ArchiveReceiptCommandHandler : IRequestHandler<ArchiveReceiptCommand, bool>
{
    private readonly IReceiptRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public ArchiveReceiptCommandHandler(
        IReceiptRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(ArchiveReceiptCommand request, CancellationToken ct)
    {
        var receipt = await _repository.GetByIdAsync(request.ReceiptId, ct);
        if (receipt is null) return false;

        if (receipt.IsArchived)
            throw new InvalidOperationException("Receipt is already archived.");

        // Default: 10 years from end of current fiscal year (Dec 31)
        var fiscalYearEnd = new DateTimeOffset(DateTime.UtcNow.Year, 12, 31, 23, 59, 59, TimeSpan.Zero);
        var retainUntil = fiscalYearEnd.AddYears(10);

        receipt.Archive(request.UserName, request.Reason, retainUntil);
        await _repository.UpdateAsync(receipt, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceArchived,
            $"Receipt '{receipt.FileName}' archived. Reason: {request.Reason}. Retain until: {retainUntil:yyyy-MM-dd}",
            entityType: "Receipt",
            entityId: request.ReceiptId.ToString(),
            ct: ct);

        return true;
    }
}
