using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

/// <summary>
/// REQ-066: Reopens a closed fiscal period. Admin-only access.
/// </summary>
public sealed record ReopenFiscalPeriodCommand : IRequest<FiscalPeriodDto?>
{
    public required Guid Id { get; init; }
    public required string UserName { get; init; }
}
