using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Transactions.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

public sealed class DetachReceiptFromTransactionCommandHandler
    : IRequestHandler<DetachReceiptFromTransactionCommand, TransactionDto?>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DetachReceiptFromTransactionCommandHandler(
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<TransactionDto?> Handle(DetachReceiptFromTransactionCommand request, CancellationToken ct)
    {
        var transaction = await _transactionRepository.GetByIdAsync(request.TransactionId, ct);
        if (transaction is null) return null;

        if (transaction.ReceiptId is null)
            throw new InvalidOperationException("Transaction has no receipt attached.");

        transaction.DetachReceipt();
        await _transactionRepository.UpdateAsync(transaction, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Receipt detached from transaction '{transaction.Description}'",
            entityType: "Transaction",
            entityId: request.TransactionId.ToString(),
            ct: ct);

        return GetTransactionsQueryHandler.MapToDto(transaction);
    }
}
