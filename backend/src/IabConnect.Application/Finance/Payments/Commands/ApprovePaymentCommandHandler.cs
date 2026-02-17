using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class ApprovePaymentCommandHandler : IRequestHandler<ApprovePaymentCommand, Unit>
{
    private readonly IPaymentRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public ApprovePaymentCommandHandler(
        IPaymentRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<Unit> Handle(ApprovePaymentCommand request, CancellationToken ct)
    {
        var payment = await _repository.GetByIdAsync(request.Id, ct)
            ?? throw new InvalidOperationException($"Payment {request.Id} not found.");

        payment.Approve(request.UserName, request.Comment);

        await _repository.UpdateAsync(payment, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Payment {payment.Id} approved ({payment.Amount:N2})",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return Unit.Value;
    }
}
