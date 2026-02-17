using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class CloseFiscalPeriodCommandHandler
    : IRequestHandler<CloseFiscalPeriodCommand, FiscalPeriodDto?>
{
    private readonly IFiscalPeriodRepository _repository;
    private readonly ITransactionRepository _transactionRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CloseFiscalPeriodCommandHandler(
        IFiscalPeriodRepository repository,
        ITransactionRepository transactionRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _transactionRepository = transactionRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<FiscalPeriodDto?> Handle(CloseFiscalPeriodCommand request, CancellationToken ct)
    {
        var period = await _repository.GetByIdAsync(request.Id, ct);
        if (period is null)
            return null;

        // Calculate totals for the period's date range
        var (totalIncome, totalExpense) = await _transactionRepository.GetSummaryAsync(
            period.StartDate, period.EndDate, ct);

        period.Close(request.UserName, totalIncome, totalExpense, request.Notes);

        await _repository.UpdateAsync(period, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Closed fiscal period {period.Name} (Income: {totalIncome:N2}, Expense: {totalExpense:N2}, Balance: {totalIncome - totalExpense:N2})",
            entityType: "FiscalPeriod", entityId: period.Id.ToString(), ct: ct);

        return GenerateFiscalPeriodsCommandHandler.MapToDto(period);
    }
}
