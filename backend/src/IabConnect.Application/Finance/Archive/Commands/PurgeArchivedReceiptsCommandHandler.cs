using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Purges archived receipts whose retention period has expired.
/// Only receipts with RetainUntil &lt;= now are physically deleted (Admin only).
/// </summary>
public sealed class PurgeArchivedReceiptsCommandHandler : IRequestHandler<PurgeArchivedReceiptsCommand, int>
{
    private readonly IReceiptRepository _repository;
    private readonly IFinanceDocumentStorage _documentStorage;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public PurgeArchivedReceiptsCommandHandler(
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

    public async Task<int> Handle(PurgeArchivedReceiptsCommand request, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow;
        var expired = await _repository.GetExpiredArchivedAsync(now, ct);

        if (expired.Count == 0) return 0;

        foreach (var receipt in expired)
        {
            // Delete the file from storage if it exists
            if (!string.IsNullOrEmpty(receipt.FilePath))
            {
                await _documentStorage.DeleteReceiptAsync(receipt.FilePath, ct);
            }

            // Physically remove from database
            await _repository.RemoveAsync(receipt, ct);
        }

        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinancePurged,
            $"{expired.Count} archived receipt(s) purged past retention period by {request.UserName}",
            entityType: "Receipt",
            details: $"Purged IDs: {string.Join(", ", expired.Select(r => r.Id))}",
            ct: ct);

        return expired.Count;
    }
}
