using MediatR;

namespace IabConnect.Application.Finance.FiscalPeriods.Commands;

/// <summary>
/// REQ-066: Locks a fiscal period to prevent mutations on transactions/invoices/payments within that date range.
/// </summary>
public sealed record LockFiscalPeriodCommand : IRequest<FiscalPeriodDto?>
{
    public required Guid Id { get; init; }
    public string? Notes { get; init; }
    public required string UserName { get; init; }
}
