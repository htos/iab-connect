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

    public DeleteInvoiceCommandHandler(
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<Result> Handle(DeleteInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.Id, ct);
        if (invoice is null)
            return Result.Failure("Invoice not found.");

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
