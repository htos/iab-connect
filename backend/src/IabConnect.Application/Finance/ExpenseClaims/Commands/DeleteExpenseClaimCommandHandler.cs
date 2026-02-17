using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class DeleteExpenseClaimCommandHandler : IRequestHandler<DeleteExpenseClaimCommand, bool>
{
    private readonly IExpenseClaimRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteExpenseClaimCommandHandler(
        IExpenseClaimRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteExpenseClaimCommand request, CancellationToken ct)
    {
        var claim = await _repository.GetByIdAsync(request.Id, ct);
        if (claim is null) return false;

        claim.SoftDelete(request.UserName);

        await _repository.UpdateAsync(claim, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Expense claim '{claim.Title}' soft-deleted ({claim.Amount:N2})",
            entityType: "ExpenseClaim",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
