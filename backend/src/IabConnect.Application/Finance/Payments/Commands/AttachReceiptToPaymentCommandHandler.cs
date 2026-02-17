using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Payments.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class AttachReceiptToPaymentCommandHandler
    : IRequestHandler<AttachReceiptToPaymentCommand, PaymentDto?>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IReceiptRepository _receiptRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public AttachReceiptToPaymentCommandHandler(
        IPaymentRepository paymentRepository,
        IReceiptRepository receiptRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _paymentRepository = paymentRepository;
        _receiptRepository = receiptRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<PaymentDto?> Handle(AttachReceiptToPaymentCommand request, CancellationToken ct)
    {
        var payment = await _paymentRepository.GetByIdAsync(request.PaymentId, ct);
        if (payment is null) return null;

        var receipt = await _receiptRepository.GetByIdAsync(request.ReceiptId, ct);
        if (receipt is null) return null;

        payment.AttachReceipt(request.ReceiptId);
        await _paymentRepository.UpdateAsync(payment, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Receipt '{receipt.FileName}' attached to payment '{payment.Id}'",
            entityType: "Payment",
            entityId: request.PaymentId.ToString(),
            ct: ct);

        return GetPaymentsQueryHandler.MapToDto(payment);
    }
}
