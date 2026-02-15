using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class SendInvoiceCommandHandler : IRequestHandler<SendInvoiceCommand, InvoiceDetailDto?>
{
    private readonly IInvoiceRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public SendInvoiceCommandHandler(
        IInvoiceRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<InvoiceDetailDto?> Handle(SendInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.Id, ct);
        if (invoice is null) return null;

        invoice.MarkAsSent(request.UserName);

        await _repository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            $"Invoice '{invoice.InvoiceNumber}' marked as sent",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return GetInvoicesQueryHandler.MapToDetailDto(invoice);
    }
}
