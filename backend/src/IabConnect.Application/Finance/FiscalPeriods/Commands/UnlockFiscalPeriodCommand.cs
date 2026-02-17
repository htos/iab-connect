using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

/// <summary>
/// REQ-066: Unlocks a previously locked fiscal period to allow mutations again.
/// </summary>
public sealed record UnlockFiscalPeriodCommand : IRequest<FiscalPeriodDto?>
{
    public required Guid Id { get; init; }
    public required string UserName { get; init; }
}
