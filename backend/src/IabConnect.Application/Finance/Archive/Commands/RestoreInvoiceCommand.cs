using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Command to restore an invoice from archive (Admin only).
/// </summary>
public sealed record RestoreInvoiceCommand(Guid InvoiceId, string UserName) : IRequest<bool>;
