using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class LockFiscalPeriodCommandHandler
    : IRequestHandler<LockFiscalPeriodCommand, FiscalPeriodDto?>
{
    private readonly IFiscalPeriodRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public LockFiscalPeriodCommandHandler(
        IFiscalPeriodRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<FiscalPeriodDto?> Handle(LockFiscalPeriodCommand request, CancellationToken ct)
    {
        var period = await _repository.GetByIdAsync(request.Id, ct);
        if (period is null)
            return null;

        period.Lock(request.UserName, request.Notes);

        await _repository.UpdateAsync(period, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Locked fiscal period {period.Name}",
            entityType: "FiscalPeriod", entityId: period.Id.ToString(), ct: ct);

        return GenerateFiscalPeriodsCommandHandler.MapToDto(period);
    }
}
