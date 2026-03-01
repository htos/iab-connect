using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

public sealed class DeleteTransactionCommandHandler : IRequestHandler<DeleteTransactionCommand, bool>
{
    private readonly ITransactionRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IAccountingPostingService _postingService;

    public DeleteTransactionCommandHandler(
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService,
        IAccountingPostingService postingService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
        _postingService = postingService;
    }

    public async Task<bool> Handle(DeleteTransactionCommand request, CancellationToken ct)
    {
        var transaction = await _repository.GetByIdAsync(request.Id, ct);
        if (transaction is null) return false;

        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(transaction.Date, ct);

        // REQ-078: Reverse the journal entry if double-entry is active
        await _postingService.ReversePostingAsync("Transaction", transaction.Id, request.UserName, "Transaction deleted", ct);

        transaction.SoftDelete(request.UserName);
        await _repository.UpdateAsync(transaction, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Transaction '{transaction.Description}' soft-deleted",
            entityType: "Transaction",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
