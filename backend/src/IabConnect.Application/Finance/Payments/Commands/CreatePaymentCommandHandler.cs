using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Payments.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class CreatePaymentCommandHandler : IRequestHandler<CreatePaymentCommand, PaymentDto>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreatePaymentCommandHandler(
        IPaymentRepository paymentRepository,
        IInvoiceRepository invoiceRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _paymentRepository = paymentRepository;
        _invoiceRepository = invoiceRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<PaymentDto> Handle(CreatePaymentCommand request, CancellationToken ct)
    {
        var method = Enum.Parse<PaymentMethod>(request.Method, ignoreCase: true);

        var payment = Payment.Create(
            request.Date, request.Amount, method, request.Reference,
            request.InvoiceId, request.TransactionId, request.Notes,
            request.UserName);

        await _paymentRepository.AddAsync(payment, ct);

        // Check if linked invoice is now fully paid
        if (request.InvoiceId.HasValue)
        {
            var invoice = await _invoiceRepository.GetByIdAsync(request.InvoiceId.Value, ct);
            if (invoice is not null && invoice.Status is InvoiceStatus.Sent or InvoiceStatus.Overdue)
            {
                var allPayments = await _paymentRepository.GetByInvoiceIdAsync(invoice.Id, ct);
                var totalPaid = allPayments.Sum(p => p.Amount) + request.Amount;
                if (totalPaid >= invoice.Total)
                {
                    invoice.MarkAsPaid(request.UserName);
                    await _invoiceRepository.UpdateAsync(invoice, ct);
                }
            }
        }

        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Payment of {payment.Amount:N2} recorded ({payment.Method})",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return GetPaymentsQueryHandler.MapToDto(payment);
    }
}
