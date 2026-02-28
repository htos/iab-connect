using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Command to archive a finalized invoice.
/// </summary>
public sealed record ArchiveInvoiceCommand(Guid InvoiceId, string Reason, string UserName) : IRequest<bool>;
