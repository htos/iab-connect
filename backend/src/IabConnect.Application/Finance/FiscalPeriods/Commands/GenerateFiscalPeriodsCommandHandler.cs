using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

public sealed class GenerateFiscalPeriodsCommandHandler
    : IRequestHandler<GenerateFiscalPeriodsCommand, List<FiscalPeriodDto>>
{
    private readonly IFiscalPeriodRepository _periodRepository;
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public GenerateFiscalPeriodsCommandHandler(
        IFiscalPeriodRepository periodRepository,
        IFinanceProfileRepository profileRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _periodRepository = periodRepository;
        _profileRepository = profileRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<List<FiscalPeriodDto>> Handle(GenerateFiscalPeriodsCommand request, CancellationToken ct)
    {
        var profile = await _profileRepository.GetActiveProfileAsync(ct);
        if (profile is null)
            throw new InvalidOperationException("No active finance profile found. Please create one first.");

        var startMonth = profile.FiscalYearStartMonth;
        var existingPeriods = await _periodRepository.GetAllAsync(request.Year, ct);
        var newPeriods = new List<FiscalPeriod>();

        for (int i = 0; i < 12; i++)
        {
            var month = ((startMonth - 1 + i) % 12) + 1;
            var year = request.Year + ((startMonth - 1 + i) / 12);

            // Skip if already exists
            if (existingPeriods.Any(p => p.Year == year && p.Month == month))
                continue;

            var startDate = new DateTime(year, month, 1, 0, 0, 0, DateTimeKind.Utc);
            var endDate = startDate.AddMonths(1).AddDays(-1);
            // Set end date to end of day
            endDate = new DateTime(endDate.Year, endDate.Month, endDate.Day, 23, 59, 59, DateTimeKind.Utc);

            var period = FiscalPeriod.Create(year, month, startDate, endDate);
            newPeriods.Add(period);
        }

        if (newPeriods.Count > 0)
        {
            await _periodRepository.AddRangeAsync(newPeriods, ct);
            await _unitOfWork.SaveChangesAsync(ct);

            await _auditService.LogActionAsync(
                AuditEventType.FinanceCreated,
                $"Generated {newPeriods.Count} fiscal periods for year {request.Year}",
                entityType: "FiscalPeriod", entityId: request.Year.ToString(), ct: ct);
        }

        // Return all periods for the year (including pre-existing)
        var allPeriods = await _periodRepository.GetAllAsync(request.Year, ct);
        return allPeriods.Select(MapToDto).ToList();
    }

    internal static FiscalPeriodDto MapToDto(FiscalPeriod p) => new(
        p.Id, p.Name, p.Year, p.Month, p.StartDate, p.EndDate,
        p.Status.ToString(), p.LockedAt, p.LockedBy, p.UnlockedAt, p.UnlockedBy, p.LockNotes,
        p.TotalIncome, p.TotalExpense, p.ClosingBalance);
}
