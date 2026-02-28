using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class MarkInvoiceAsOverdueCommandHandler
    : IRequestHandler<MarkInvoiceAsOverdueCommand, InvoiceDetailDto?>
{
    private readonly IInvoiceRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public MarkInvoiceAsOverdueCommandHandler(
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<InvoiceDetailDto?> Handle(MarkInvoiceAsOverdueCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.Id, ct);
        if (invoice is null) return null;

        if (invoice.Status != InvoiceStatus.Sent)
            throw new InvalidOperationException("Only sent invoices can be marked as overdue.");

        if (invoice.DueDate >= DateTime.UtcNow)
            throw new InvalidOperationException("Invoice due date has not passed yet.");

        invoice.MarkAsOverdue(request.UserName);

        await _repository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            $"Invoice '{invoice.InvoiceNumber}' marked as overdue",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return GetInvoicesQueryHandler.MapToDetailDto(invoice);
    }
}
