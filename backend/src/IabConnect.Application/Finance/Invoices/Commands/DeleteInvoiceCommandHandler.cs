using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class DeleteInvoiceCommandHandler : IRequestHandler<DeleteInvoiceCommand, Result>
{
    private readonly IInvoiceRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;
    private readonly IFiscalPeriodService _fiscalPeriodService;

    public DeleteInvoiceCommandHandler(
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        IFiscalPeriodService fiscalPeriodService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
        _fiscalPeriodService = fiscalPeriodService;
    }

    public async Task<Result> Handle(DeleteInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.Id, ct);
        if (invoice is null)
            return Result.Failure("Invoice not found.");

        // REQ-070: Reject deletion of archived invoices
        if (invoice.IsArchived)
            return Result.Failure("Cannot delete an archived invoice.");

        // REQ-066: Check fiscal period locking
        await _fiscalPeriodService.EnsurePeriodNotLockedAsync(invoice.Date, ct);

        if (invoice.Status is InvoiceStatus.Sent or InvoiceStatus.Overdue)
            return Result.Failure("Sent or overdue invoices must be cancelled using the cancel endpoint.");

        if (invoice.Status is InvoiceStatus.Paid or InvoiceStatus.Cancelled)
            return Result.Failure("Paid or cancelled invoices cannot be deleted.");

        invoice.SoftDelete(request.UserName);
        await _repository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Invoice '{invoice.InvoiceNumber}' soft-deleted",
            entityType: "Invoice",
            entityId: request.Id.ToString(),
            ct: ct);

        return Result.Success();
    }
}
