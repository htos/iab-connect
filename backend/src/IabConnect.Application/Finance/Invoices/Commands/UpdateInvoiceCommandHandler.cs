using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class UpdateInvoiceCommandHandler : IRequestHandler<UpdateInvoiceCommand, InvoiceDetailDto?>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly ITaxCodeRepository _taxCodeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateInvoiceCommandHandler(
        IInvoiceRepository invoiceRepository,
        ITaxCodeRepository taxCodeRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _invoiceRepository = invoiceRepository;
        _taxCodeRepository = taxCodeRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<InvoiceDetailDto?> Handle(UpdateInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _invoiceRepository.GetByIdAsync(request.Id, ct);
        if (invoice is null) return null;

        var recipientType = Enum.Parse<RecipientType>(request.RecipientType, ignoreCase: true);

        invoice.Update(
            request.Date, request.DueDate, recipientType,
            request.RecipientId, request.RecipientName,
            request.RecipientAddress, request.TaxRate, request.Notes,
            request.UserName);

        var newItems = new List<InvoiceItem>();
        foreach (var i in request.Items)
        {
            decimal? snapshotTaxRate = null;
            if (i.TaxCodeId.HasValue)
            {
                var taxCode = await _taxCodeRepository.GetByIdAsync(i.TaxCodeId.Value, ct);
                if (taxCode is not null)
                    snapshotTaxRate = taxCode.Rate;
            }
            newItems.Add(InvoiceItem.CreateWithTax(
                invoice.Id, i.Description, i.Quantity, i.UnitPrice,
                i.TaxCodeId, snapshotTaxRate, i.IsGrossEntry));
        }
        invoice.SetItems(newItems);

        await _invoiceRepository.UpdateAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Invoice '{invoice.InvoiceNumber}' updated",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return GetInvoicesQueryHandler.MapToDetailDto(invoice);
    }
}
