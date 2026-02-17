using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

/// <summary>
/// REQ-066: Closes a fiscal period and calculates balance carry-forward totals.
/// </summary>
public sealed record CloseFiscalPeriodCommand : IRequest<FiscalPeriodDto?>
{
    public required Guid Id { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
