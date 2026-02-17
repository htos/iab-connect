using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Queries;

/// <summary>
/// REQ-068: P&amp;L report broken down by activity area
/// </summary>
public sealed record GetActivityAreaReportQuery(DateTime? From, DateTime? To) : IRequest<List<ActivityAreaReportDto>>;

public sealed record ActivityAreaReportDto(
    Guid? ActivityAreaId, string? ActivityAreaName, string? ActivityAreaCode,
    decimal TotalIncome, decimal TotalExpense, decimal Balance);

public sealed class GetActivityAreaReportQueryHandler : IRequestHandler<GetActivityAreaReportQuery, List<ActivityAreaReportDto>>
{
    private readonly ITransactionRepository _transactionRepository;
    private readonly IActivityAreaRepository _activityAreaRepository;

    public GetActivityAreaReportQueryHandler(
        ITransactionRepository transactionRepository,
        IActivityAreaRepository activityAreaRepository)
    {
        _transactionRepository = transactionRepository;
        _activityAreaRepository = activityAreaRepository;
    }

    public async Task<List<ActivityAreaReportDto>> Handle(GetActivityAreaReportQuery request, CancellationToken ct)
    {
        var from = request.From.HasValue
            ? DateTime.SpecifyKind(request.From.Value, DateTimeKind.Utc)
            : (DateTime?)null;
        var to = request.To.HasValue
            ? DateTime.SpecifyKind(request.To.Value, DateTimeKind.Utc)
            : (DateTime?)null;

        var transactions = await _transactionRepository.GetAllAsync(from, to, ct: ct);
        var areas = await _activityAreaRepository.GetAllActiveAsync(ct);
        var areaLookup = areas.ToDictionary(a => a.Id);

        var grouped = transactions
            .GroupBy(t => t.ActivityAreaId)
            .Select(g =>
            {
                var areaId = g.Key;
                string? areaName = null;
                string? areaCode = null;

                if (areaId.HasValue && areaLookup.TryGetValue(areaId.Value, out var area))
                {
                    areaName = area.Name;
                    areaCode = area.Code;
                }

                var totalIncome = g
                    .Where(t => t.Type == TransactionType.Income)
                    .Sum(t => t.Amount);
                var totalExpense = g
                    .Where(t => t.Type == TransactionType.Expense)
                    .Sum(t => t.Amount);

                return new ActivityAreaReportDto(
                    areaId, areaName, areaCode,
                    totalIncome, totalExpense, totalIncome - totalExpense);
            })
            .OrderBy(r => r.ActivityAreaCode ?? "zzz")
            .ToList();

        return grouped;
    }
}
