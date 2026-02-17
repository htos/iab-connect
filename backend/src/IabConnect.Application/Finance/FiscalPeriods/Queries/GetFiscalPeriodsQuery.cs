using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Queries;

/// <summary>
/// REQ-066: Retrieves all fiscal periods, optionally filtered by year.
/// </summary>
public sealed record GetFiscalPeriodsQuery(int? Year = null) : IRequest<List<FiscalPeriodDto>>;
