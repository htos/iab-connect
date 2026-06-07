using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Budgets.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Commands;

public sealed class UpdateBudgetCommandHandler : IRequestHandler<UpdateBudgetCommand, BudgetDto?>
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly IActivityAreaRepository _activityAreaRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;
    private readonly IFinanceProfileRepository _financeProfileRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateBudgetCommandHandler(
        IBudgetRepository budgetRepository,
        IActivityAreaRepository activityAreaRepository,
        IFiscalPeriodRepository fiscalPeriodRepository,
        IFinanceProfileRepository financeProfileRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _budgetRepository = budgetRepository;
        _activityAreaRepository = activityAreaRepository;
        _fiscalPeriodRepository = fiscalPeriodRepository;
        _financeProfileRepository = financeProfileRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<BudgetDto?> Handle(UpdateBudgetCommand request, CancellationToken ct)
    {
        var budget = await _budgetRepository.GetByIdAsync(request.Id, ct);
        if (budget is null) return null;

        var period = await _fiscalPeriodRepository.GetByIdAsync(budget.FiscalPeriodId, ct)
            ?? throw new KeyNotFoundException("Fiscal period not found.");

        // Locked-period guard: no budget mutations in a hard-locked period.
        if (!period.IsMutationAllowed)
            throw new InvalidOperationException(
                $"Fiscal period {period.Name} is locked. Budgets cannot be modified for this period.");

        var currency = await ResolveCurrencyAsync(request.Currency, budget.Currency, ct);

        budget.Update(request.Amount, currency, request.Notes, request.UserName);

        await _budgetRepository.UpdateAsync(budget, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        var area = await _activityAreaRepository.GetByIdAsync(budget.ActivityAreaId, ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Budget {budget.Amount:0.00} {currency} for cost center '{area?.Name}' / period {period.Name} updated",
            entityType: "Budget",
            entityId: budget.Id.ToString(),
            ct: ct);

        return BudgetMapper.ToDto(budget, area, period);
    }

    private async Task<FinanceCurrency> ResolveCurrencyAsync(string? requested, FinanceCurrency current, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
            return Enum.Parse<FinanceCurrency>(requested, ignoreCase: true);

        var profile = await _financeProfileRepository.GetActiveProfileAsync(ct);
        return profile?.Currency ?? current;
    }
}
