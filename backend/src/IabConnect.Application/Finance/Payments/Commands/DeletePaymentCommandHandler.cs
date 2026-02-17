using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class DeletePaymentCommandHandler : IRequestHandler<DeletePaymentCommand, bool>
{
    private readonly IPaymentRepository _repository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;

    public DeletePaymentCommandHandler(
        IPaymentRepository repository,
        IInvoiceRepository invoiceRepository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService)
    {
        _repository = repository;
        _invoiceRepository = invoiceRepository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
    }

    public async Task<bool> Handle(DeletePaymentCommand request, CancellationToken ct)
    {
        var payment = await _repository.GetByIdAsync(request.Id, ct);
        if (payment is null) return false;

        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(payment.Date, ct);

        // Capture linked IDs before soft-delete
        var invoiceId = payment.InvoiceId;
        var transactionId = payment.TransactionId;

        payment.SoftDelete(request.UserName);
        await _repository.UpdateAsync(payment, ct);

        // Soft-delete linked auto-booked transaction
        if (transactionId.HasValue)
        {
            var transaction = await _transactionRepository.GetByIdAsync(transactionId.Value, ct);
            if (transaction is not null)
            {
                transaction.SoftDelete(request.UserName);
                await _transactionRepository.UpdateAsync(transaction, ct);
            }
        }

        // Recalculate invoice payment status
        if (invoiceId.HasValue)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(invoiceId.Value, ct);
            if (invoice is not null)
            {
                var remainingPayments = await _repository.GetByInvoiceIdAsync(invoice.Id, ct);
                var totalPaid = remainingPayments.Sum(p => p.Amount);
                invoice.RecalculatePaymentStatus(totalPaid, request.UserName);
                await _invoiceRepository.UpdateAsync(invoice, ct);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Payment soft-deleted ({payment.Amount:N2})",
            entityType: "Payment",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
