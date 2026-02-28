using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Receipts.Commands;

public sealed class DeleteReceiptCommandHandler : IRequestHandler<DeleteReceiptCommand, bool>
{
    private readonly IReceiptRepository _repository;
    private readonly IFinanceDocumentStorage _documentStorage;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteReceiptCommandHandler(
        IReceiptRepository repository,
        IFinanceDocumentStorage documentStorage,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _documentStorage = documentStorage;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteReceiptCommand request, CancellationToken ct)
    {
        var receipt = await _repository.GetByIdAsync(request.Id, ct);
        if (receipt is null) return false;

        // REQ-070: Archive instead of soft-delete for compliance retention
        if (receipt.IsArchived)
            throw new InvalidOperationException("Receipt is already archived.");

        var fiscalYearEnd = new DateTimeOffset(DateTime.UtcNow.Year, 12, 31, 23, 59, 59, TimeSpan.Zero);
        var retainUntil = fiscalYearEnd.AddYears(10);

        receipt.Archive(request.UserName ?? "system", "Deleted via receipt management", retainUntil);
        await _repository.UpdateAsync(receipt, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceArchived,
            $"Receipt '{receipt.FileName}' archived (was delete request) with 10-year retention",
            entityType: "Receipt",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
