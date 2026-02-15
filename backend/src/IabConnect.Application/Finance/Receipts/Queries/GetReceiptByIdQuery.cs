using MediatR;

namespace IabConnect.Application.Finance.Receipts.Queries;

/// <summary>
/// Query to get a receipt by ID (REQ-043)
/// </summary>
public sealed record GetReceiptByIdQuery(Guid Id) : IRequest<ReceiptDto?>;
