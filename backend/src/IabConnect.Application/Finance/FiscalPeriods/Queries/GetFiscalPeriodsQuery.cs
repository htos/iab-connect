using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Queries;

/// <summary>
/// REQ-066: Retrieves all fiscal periods, optionally filtered by year, with pagination.
/// </summary>
public sealed record GetFiscalPeriodsQuery(int? Year = null) : IRequest<PagedResult<FiscalPeriodDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
