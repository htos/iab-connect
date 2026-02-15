using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Transactions.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Transactions.Commands;

public sealed class AttachReceiptToTransactionCommandHandler
    : IRequestHandler<AttachReceiptToTransactionCommand, TransactionDto?>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IReceiptRepository _receiptRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public AttachReceiptToTransactionCommandHandler(
        ITransactionRepository transactionRepository,
        IReceiptRepository receiptRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _transactionRepository = transactionRepository;
        _receiptRepository = receiptRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<TransactionDto?> Handle(AttachReceiptToTransactionCommand request, CancellationToken ct)
    {
        var transaction = await _transactionRepository.GetByIdAsync(request.TransactionId, ct);
        if (transaction is null) return null;

        var receipt = await _receiptRepository.GetByIdAsync(request.ReceiptId, ct);
        if (receipt is null) return null;

        transaction.AttachReceipt(request.ReceiptId);
        await _transactionRepository.UpdateAsync(transaction, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Receipt '{receipt.FileName}' attached to transaction '{transaction.Description}'",
            entityType: "Transaction",
            entityId: request.TransactionId.ToString(),
            ct: ct);

        return GetTransactionsQueryHandler.MapToDto(transaction);
    }
}
