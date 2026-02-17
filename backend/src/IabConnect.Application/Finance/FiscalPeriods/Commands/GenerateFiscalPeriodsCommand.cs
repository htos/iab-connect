using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

/// <summary>
/// REQ-066: Generates 12 monthly fiscal periods for a given year based on the active FinanceProfile's fiscal year start month.
/// </summary>
public sealed record GenerateFiscalPeriodsCommand : IRequest<List<FiscalPeriodDto>>
{
    public required int Year { get; init; }
    public required string UserName { get; init; }
}
