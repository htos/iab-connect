using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Archive.Commands;

/// <summary>
/// REQ-070: Archives a finalized invoice with 10-year retention (Swiss OR Art. 958f).
/// </summary>
public sealed class ArchiveInvoiceCommandHandler : IRequestHandler<ArchiveInvoiceCommand, bool>
{
    private readonly IInvoiceRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public ArchiveInvoiceCommandHandler(
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(ArchiveInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.InvoiceId, ct);
        if (invoice is null) return false;

        if (invoice.IsArchived)
            throw new InvalidOperationException("Invoice is already archived.");

        // Default: 10 years from end of current fiscal year (Dec 31)
        var fiscalYearEnd = new DateTimeOffset(DateTime.UtcNow.Year, 12, 31, 23, 59, 59, TimeSpan.Zero);
        var retainUntil = fiscalYearEnd.AddYears(10);

        invoice.Archive(request.UserName, request.Reason, retainUntil);
        await _repository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceArchived,
            $"Invoice '{invoice.InvoiceNumber}' archived. Reason: {request.Reason}. Retain until: {retainUntil:yyyy-MM-dd}",
            entityType: "Invoice",
            entityId: request.InvoiceId.ToString(),
            ct: ct);

        return true;
    }
}
