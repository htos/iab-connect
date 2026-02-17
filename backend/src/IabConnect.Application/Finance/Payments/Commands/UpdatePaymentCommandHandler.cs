using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Payments.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class UpdatePaymentCommandHandler : IRequestHandler<UpdatePaymentCommand, PaymentDto?>
{
    private readonly IPaymentRepository _repository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;

    public UpdatePaymentCommandHandler(
        IPaymentRepository repository,
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService)
    {
        _repository = repository;
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
    }

    public async Task<PaymentDto?> Handle(UpdatePaymentCommand request, CancellationToken ct)
    {
        var payment = await _repository.GetByIdAsync(request.Id, ct);
        if (payment is null) return null;

        // REQ-066: Check fiscal period locking (old and new dates)
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(payment.Date, ct);
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(request.Date, ct);

        // Capture old invoice ID before update for recalculation
        var oldInvoiceId = payment.InvoiceId;

        var direction = Enum.Parse<PaymentDirection>(request.Direction, ignoreCase: true);
        var method = Enum.Parse<PaymentMethod>(request.Method, ignoreCase: true);

        payment.Update(
            request.Date, request.Amount, direction, method, request.Reference,
            request.InvoiceId, request.TransactionId, request.Notes,
            request.UserName);

        await _repository.UpdateAsync(payment, ct);

        // Recalculate invoice payment status for the old invoice (if it changed or amount changed)
        if (oldInvoiceId.HasValue)
        {
            var oldInvoice = await _invoiceRepository.GetByIdAsync(oldInvoiceId.Value, ct);
            if (oldInvoice is not null)
            {
                var payments = await _repository.GetByInvoiceIdAsync(oldInvoice.Id, ct);
                var totalPaid = payments.Sum(p => p.Amount);
                oldInvoice.RecalculatePaymentStatus(totalPaid, request.UserName);
                await _invoiceRepository.UpdateAsync(oldInvoice, ct);
            }
        }

        // Recalculate for the new invoice (if different from old)
        if (request.InvoiceId.HasValue && request.InvoiceId != oldInvoiceId)
        {
            var newInvoice = await _invoiceRepository.GetByIdAsync(request.InvoiceId.Value, ct);
            if (newInvoice is not null)
            {
                var payments = await _repository.GetByInvoiceIdAsync(newInvoice.Id, ct);
                var totalPaid = payments.Sum(p => p.Amount);
                newInvoice.RecalculatePaymentStatus(totalPaid, request.UserName);
                await _invoiceRepository.UpdateAsync(newInvoice, ct);
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Payment {payment.Id} updated ({payment.Amount:N2})",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return GetPaymentsQueryHandler.MapToDto(payment);
    }
}
