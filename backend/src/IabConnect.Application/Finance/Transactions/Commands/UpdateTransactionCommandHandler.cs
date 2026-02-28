using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Transactions.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

public sealed class UpdateTransactionCommandHandler : IRequestHandler<UpdateTransactionCommand, TransactionDto?>
{
    private readonly ITransactionRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;

    public UpdateTransactionCommandHandler(
        ITransactionRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
    }

    public async Task<TransactionDto?> Handle(UpdateTransactionCommand request, CancellationToken ct)
    {
        var transaction = await _repository.GetByIdAsync(request.Id, ct);
        if (transaction is null) return null;

        // REQ-070: Reject updates on archived transactions
        if (transaction.IsArchived)
            throw new InvalidOperationException("Cannot update an archived transaction.");

        // REQ-066: Check fiscal period locking (old and new dates)
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(transaction.Date, ct);
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(request.Date, ct);

        var txType = Enum.Parse<TransactionType>(request.Type, ignoreCase: true);

        transaction.Update(
            request.Date, request.Description, request.Amount, txType,
            request.AccountId, request.CategoryId, request.Reference,
            request.Notes, request.UserName,
            request.TaxCodeId, request.TaxRate, request.ActivityAreaId);

        await _repository.UpdateAsync(transaction, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Transaction '{transaction.Description}' updated",
            entityType: "Transaction",
            entityId: transaction.Id.ToString(),
            ct: ct);

        return GetTransactionsQueryHandler.MapToDto(transaction);
    }
}
