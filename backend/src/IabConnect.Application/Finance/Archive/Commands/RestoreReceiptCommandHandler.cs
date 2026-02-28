using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Restores a receipt from archive (Admin only).
/// </summary>
public sealed class RestoreReceiptCommandHandler : IRequestHandler<RestoreReceiptCommand, bool>
{
    private readonly IReceiptRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public RestoreReceiptCommandHandler(
        IReceiptRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(RestoreReceiptCommand request, CancellationToken ct)
    {
        var receipt = await _repository.GetByIdAsync(request.ReceiptId, ct);
        if (receipt is null) return false;

        if (!receipt.IsArchived)
            throw new InvalidOperationException("Receipt is not archived.");

        receipt.Restore(request.UserName);
        await _repository.UpdateAsync(receipt, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceRestored,
            $"Receipt '{receipt.FileName}' restored from archive by {request.UserName}",
            entityType: "Receipt",
            entityId: request.ReceiptId.ToString(),
            ct: ct);

        return true;
    }
}
