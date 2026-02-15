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

        if (!string.IsNullOrEmpty(receipt.FilePath))
        {
            await _documentStorage.DeleteReceiptAsync(receipt.FilePath, ct);
        }

        receipt.SoftDelete(request.UserName);
        await _repository.UpdateAsync(receipt, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Receipt '{receipt.FileName}' soft-deleted and file removed from storage",
            entityType: "Receipt",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
