using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Budgets.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Budgets.Commands;

public sealed class CreateBudgetCommandHandler : IRequestHandler<CreateBudgetCommand, BudgetDto>
{
    private readonly IBudgetRepository _budgetRepository;
    private readonly IActivityAreaRepository _activityAreaRepository;
    private readonly IFiscalPeriodRepository _fiscalPeriodRepository;
    private readonly IFinanceProfileRepository _financeProfileRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateBudgetCommandHandler(
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

    public async Task<BudgetDto> Handle(CreateBudgetCommand request, CancellationToken ct)
    {
        // Existence: cost center (ActivityArea) must exist and be active.
        var area = await _activityAreaRepository.GetByIdAsync(request.ActivityAreaId, ct)
            ?? throw new KeyNotFoundException("Cost center (activity area) not found.");
        if (!area.IsActive)
            throw new InvalidOperationException("Cannot budget an inactive cost center.");

        // Existence: fiscal period must exist.
        var period = await _fiscalPeriodRepository.GetByIdAsync(request.FiscalPeriodId, ct)
            ?? throw new KeyNotFoundException("Fiscal period not found.");

        // Locked-period guard: no budgets in a hard-locked period.
        if (!period.IsMutationAllowed)
            throw new InvalidOperationException(
                $"Fiscal period {period.Name} is locked. Budgets cannot be created for this period.");

        // Uniqueness: one active budget per (area, period) pair.
        var existing = await _budgetRepository.GetByActivityAreaAndPeriodAsync(
            request.ActivityAreaId, request.FiscalPeriodId, ct);
        if (existing is not null)
            throw new InvalidOperationException(
                "A budget already exists for this cost center and fiscal period.");

        var currency = await ResolveCurrencyAsync(request.Currency, ct);

        var budget = Budget.Create(
            request.ActivityAreaId, request.FiscalPeriodId, request.Amount,
            currency, request.Notes, request.UserName);

        await _budgetRepository.AddAsync(budget, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Budget {budget.Amount:0.00} {currency} for cost center '{area.Name}' / period {period.Name} created",
            entityType: "Budget",
            entityId: budget.Id.ToString(),
            ct: ct);

        return BudgetMapper.ToDto(budget, area, period);
    }

    private async Task<FinanceCurrency> ResolveCurrencyAsync(string? requested, CancellationToken ct)
    {
        if (!string.IsNullOrWhiteSpace(requested))
            return Enum.Parse<FinanceCurrency>(requested, ignoreCase: true);

        var profile = await _financeProfileRepository.GetActiveProfileAsync(ct);
        return profile?.Currency ?? FinanceCurrency.CHF;
    }
}
