using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.BankImports.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed class UnmatchBankImportItemCommandHandler
    : IRequestHandler<UnmatchBankImportItemCommand, BankImportItemDto?>
{
    private readonly IBankImportRepository _repository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UnmatchBankImportItemCommandHandler(
        IBankImportRepository repository,
        IPaymentRepository paymentRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _paymentRepository = paymentRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<BankImportItemDto?> Handle(UnmatchBankImportItemCommand request, CancellationToken ct)
    {
        var bankImport = await _repository.GetByIdAsync(request.BankImportId, ct);
        if (bankImport is null) return null;

        var item = bankImport.Items.FirstOrDefault(i => i.Id == request.ItemId);
        if (item is null) return null;

        if (item.Status != BankImportItemStatus.Matched)
            throw new InvalidOperationException("Only matched items can be unmatched.");

        // Capture matched payment ID before unmatch clears it
        var matchedPaymentId = item.MatchedPaymentId;

        item.Unmatch();

        // Reverse auto-created transaction if payment was linked
        if (matchedPaymentId.HasValue)
        {
            var payment = await _paymentRepository.GetByIdAsync(matchedPaymentId.Value, ct);
            if (payment is not null && payment.TransactionId.HasValue)
            {
                await _transactionRepository.DeleteAsync(payment.TransactionId.Value, ct);
                payment.ClearTransaction();
                await _paymentRepository.UpdateAsync(payment, ct);
            }
        }

        // Bank import may no longer be fully processed
        // Status remains as-is since MarkAsProcessed is one-way; items are now unmatched

        await _repository.UpdateAsync(bankImport, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Bank import item unmatched (previous payment: {matchedPaymentId})",
            entityType: "BankImportItem",
            entityId: request.ItemId.ToString(),
            ct: ct);

        return GetBankImportsQueryHandler.MapItemDto(item);
    }
}
