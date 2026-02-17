using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.ExpenseClaims.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.ExpenseClaims.Commands;

public sealed class SubmitExpenseClaimCommandHandler : IRequestHandler<SubmitExpenseClaimCommand, ExpenseClaimDto>
{
    private readonly IExpenseClaimRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public SubmitExpenseClaimCommandHandler(
        IExpenseClaimRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ExpenseClaimDto> Handle(SubmitExpenseClaimCommand request, CancellationToken ct)
    {
        var claim = await _repository.GetByIdAsync(request.Id, ct)
            ?? throw new InvalidOperationException($"Expense claim {request.Id} not found.");

        claim.Submit(request.UserName);

        await _repository.UpdateAsync(claim, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Expense claim '{claim.Title}' submitted for review",
            entityType: "ExpenseClaim",
            entityId: claim.Id.ToString(),
            ct: ct);

        return GetExpenseClaimsQueryHandler.MapToDto(claim);
    }
}
