using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.ExpenseClaims.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class UpdateExpenseClaimCommandHandler : IRequestHandler<UpdateExpenseClaimCommand, ExpenseClaimDto?>
{
    private readonly IExpenseClaimRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateExpenseClaimCommandHandler(
        IExpenseClaimRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ExpenseClaimDto?> Handle(UpdateExpenseClaimCommand request, CancellationToken ct)
    {
        var claim = await _repository.GetByIdAsync(request.Id, ct);
        if (claim is null) return null;

        claim.Update(
            request.Title,
            request.Description,
            request.Amount,
            request.Date,
            request.ReceiptId,
            request.UserName);

        await _repository.UpdateAsync(claim, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Expense claim '{claim.Title}' updated ({claim.Amount:N2})",
            entityType: "ExpenseClaim",
            entityId: claim.Id.ToString(),
            ct: ct);

        return GetExpenseClaimsQueryHandler.MapToDto(claim);
    }
}
