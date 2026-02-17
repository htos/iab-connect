using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Payments.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class DetachReceiptFromPaymentCommandHandler
    : IRequestHandler<DetachReceiptFromPaymentCommand, PaymentDto?>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DetachReceiptFromPaymentCommandHandler(
        IPaymentRepository paymentRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _paymentRepository = paymentRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<PaymentDto?> Handle(DetachReceiptFromPaymentCommand request, CancellationToken ct)
    {
        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId, ct);
        if (payment is null) return null;

        if (payment.ReceiptId is null)
            throw new InvalidOperationException("Payment has no receipt attached.");

        payment.DetachReceipt();
        await _paymentRepository.UpdateAsync(payment, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Receipt detached from payment '{payment.Id}'",
            entityType: "Payment",
            entityId: request.PaymentId.ToString(),
            ct: ct);

        return GetPaymentsQueryHandler.MapToDto(payment);
    }
}
