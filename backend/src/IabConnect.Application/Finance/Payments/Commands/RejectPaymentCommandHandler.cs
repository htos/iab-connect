using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Payments.Commands;

public sealed class RejectPaymentCommandHandler : IRequestHandler<RejectPaymentCommand, Unit>
{
    private readonly IPaymentRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public RejectPaymentCommandHandler(
        IPaymentRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<Unit> Handle(RejectPaymentCommand request, CancellationToken ct)
    {
        var payment = await _repository.GetByIdAsync(request.Id, ct)
            ?? throw new InvalidOperationException($"Payment {request.Id} not found.");

        payment.Reject(request.UserName, request.Reason);

        await _repository.UpdateAsync(payment, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Payment {payment.Id} rejected ({payment.Amount:N2}): {request.Reason}",
            entityType: "Payment",
            entityId: payment.Id.ToString(),
            ct: ct);

        return Unit.Value;
    }
}
