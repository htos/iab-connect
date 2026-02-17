using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.ExpenseClaims.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class ReimburseExpenseClaimCommandHandler : IRequestHandler<ReimburseExpenseClaimCommand, ExpenseClaimDto>
{
    private readonly IExpenseClaimRepository _expenseClaimRepository;
    private readonly IPaymentRepository _paymentRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;
    private readonly IAutoBookingService _autoBookingService;

    public ReimburseExpenseClaimCommandHandler(
        IExpenseClaimRepository expenseClaimRepository,
        IPaymentRepository paymentRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService,
        IAutoBookingService autoBookingService)
    {
        _expenseClaimRepository = expenseClaimRepository;
        _paymentRepository = paymentRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
        _autoBookingService = autoBookingService;
    }

    public async Task<ExpenseClaimDto> Handle(ReimburseExpenseClaimCommand request, CancellationToken ct)
    {
        var claim = await _expenseClaimRepository.GetByIdAsync(request.Id, ct)
            ?? throw new InvalidOperationException($"Expense claim {request.Id} not found.");

        var paymentDate = DateTime.UtcNow;

        // REQ-066: Check fiscal period locking before creating payment
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(paymentDate, ct);

        var method = Enum.Parse<PaymentMethod>(request.Method, ignoreCase: true);

        // Create a reimbursement payment
        var payment = Payment.Create(
            paymentDate,
            claim.Amount,
            PaymentDirection.Expense,
            method,
            request.Reference,
            invoiceId: null,
            transactionId: null,
            request.Notes ?? $"Reimbursement for expense claim: {claim.Title}",
            request.UserName);

        await _paymentRepository.AddAsync(payment, ct);

        // Auto-booking: create an expense transaction for the reimbursement
        await _autoBookingService.CreateTransactionForExpenseClaimAsync(claim, payment, request.UserName, ct);

        // Mark expense claim as reimbursed
        claim.Reimburse(payment.Id, request.UserName);

        await _expenseClaimRepository.UpdateAsync(claim, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Expense claim '{claim.Title}' reimbursed via payment {payment.Id} ({claim.Amount:N2} {claim.Currency})",
            entityType: "ExpenseClaim",
            entityId: claim.Id.ToString(),
            ct: ct);

        return GetExpenseClaimsQueryHandler.MapToDto(claim);
    }
}
