using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class MarkPaymentAsPaidCommandHandler : IRequestHandler<MarkPaymentAsPaidCommand, Unit>
{
    private readonly IPaymentRepository _paymentRepository;
    private readonly IFinanceProfileRepository _financeProfileRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IAutoBookingService _autoBookingService;

    public MarkPaymentAsPaidCommandHandler(
        IPaymentRepository paymentRepository,
        IFinanceProfileRepository financeProfileRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService,
        IAutoBookingService autoBookingService)
    {
        _paymentRepository = paymentRepository;
        _financeProfileRepository = financeProfileRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
        _autoBookingService = autoBookingService;
    }

    public async Task<Unit> Handle(MarkPaymentAsPaidCommand request, CancellationToken ct)
    {
        var payment = await _paymentRepository.GetByIdAsync(request.Id, ct)
            ?? throw new InvalidOperationException($"Payment {request.Id} not found.");

        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(payment.Date, ct);

        // REQ-067: Check if approval is required based on thresholds
        var profile = await _financeProfileRepository.GetActiveProfileAsync(ct);
        if (profile is not null)
        {
            if (payment.RequiresApproval(profile.ApprovalThresholdChf, profile.ApprovalThresholdEur, profile.Currency)
                && payment.Status != PaymentStatus.Approved)
            {
                throw new InvalidOperationException(
                    "Payment requires approval before it can be marked as paid. " +
                    $"Amount {payment.Amount:N2} exceeds the approval threshold.");
            }
        }

        payment.MarkAsPaid(request.UserName);

        // Auto-booking: create a general-ledger transaction for the paid payment
        if (payment.TransactionId is null)
        {
            await _autoBookingService.CreateTransactionForPaymentAsync(payment, request.UserName, ct);
        }

        await _paymentRepository.UpdateAsync(payment, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Payment {payment.Id} marked as paid ({payment.Amount:N2})",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return Unit.Value;
    }
}
