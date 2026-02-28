using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Restores an invoice from archive (Admin only).
/// </summary>
public sealed class RestoreInvoiceCommandHandler : IRequestHandler<RestoreInvoiceCommand, bool>
{
    private readonly IInvoiceRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public RestoreInvoiceCommandHandler(
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(RestoreInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return false;

        if (!invoice.IsArchived)
            throw new InvalidOperationException("Invoice is not archived.");

        invoice.Restore(request.UserName);
        await _repository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceRestored,
            $"Invoice '{invoice.InvoiceNumber}' restored from archive by {request.UserName}",
            entityType: "Invoice",
            entityId: request.InvoiceId.ToString(),
            ct: ct);

        return true;
    }
}
