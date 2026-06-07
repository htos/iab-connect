using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Commands;

public sealed class DeleteBudgetCommandHandler : IRequestHandler<DeleteBudgetCommand, bool>
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteBudgetCommandHandler(
        IBudgetRepository budgetRepository,
        IFiscalPeriodRepository fiscalPeriodRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _budgetRepository = budgetRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteBudgetCommand request, CancellationToken ct)
    {
        var budget = await _budgetRepository.GetByIdAsync(request.Id, ct);
        if (budget is null) return false;

        // Locked-period guard: budgets in a hard-locked period cannot be removed.
        var period = await _fiscalPeriodRepository.GetByIdAsync(budget.FiscalPeriodId, ct);
        if (period is not null && !period.IsMutationAllowed)
            throw new InvalidOperationException(
                $"Fiscal period {period.Name} is locked. Budgets cannot be deleted for this period.");

        budget.SoftDelete(request.UserName);
        await _budgetRepository.UpdateAsync(budget, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Budget {budget.Id} soft-deleted",
            entityType: "Budget",
            entityId: budget.Id.ToString(),
            ct: ct);

        return true;
    }
}
