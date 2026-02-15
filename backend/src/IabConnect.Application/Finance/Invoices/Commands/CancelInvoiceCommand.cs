using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

/// <summary>
/// Command to cancel (storno) an invoice (REQ-039)
/// </summary>
public sealed record CancelInvoiceCommand : IRequest<Result<InvoiceDetailDto>>
{
    public required Guid Id { get; init; }
    public required string Reason { get; init; }
    public required Guid AccountId { get; init; }
    public required string UserName { get; init; }
}
