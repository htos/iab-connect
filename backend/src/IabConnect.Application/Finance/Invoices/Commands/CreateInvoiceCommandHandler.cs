using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class CreateInvoiceCommandHandler : IRequestHandler<CreateInvoiceCommand, InvoiceDetailDto>
{
    private readonly IInvoiceRepository _invoiceRepository;
    private readonly ITaxCodeRepository _taxCodeRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateInvoiceCommandHandler(
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

    public async Task<InvoiceDetailDto> Handle(CreateInvoiceCommand request, CancellationToken ct)
    {
        var recipientType = Enum.Parse<RecipientType>(request.RecipientType, ignoreCase: true);
        var invoiceNumber = await _invoiceRepository.GetNextInvoiceNumberAsync(ct);

        var invoice = Invoice.Create(
            invoiceNumber, request.Date, request.DueDate,
            recipientType, request.RecipientId, request.RecipientName,
            request.RecipientAddress, request.TaxRate, request.Notes,
            request.UserName);

        foreach (var item in request.Items)
        {
            decimal? snapshotTaxRate = null;
            if (item.TaxCodeId.HasValue)
            {
                var taxCode = await _taxCodeRepository.GetByIdAsync(item.TaxCodeId.Value, ct);
                if (taxCode is not null)
                    snapshotTaxRate = taxCode.Rate;
            }

            invoice.AddItemWithTax(
                item.Description, item.Quantity, item.UnitPrice,
                item.TaxCodeId, snapshotTaxRate, item.IsGrossEntry);
        }

        await _invoiceRepository.AddAsync(invoice, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Invoice '{invoice.InvoiceNumber}' created for {invoice.RecipientName} ({invoice.Total:N2})",
            entityType: "Invoice",
            entityId: invoice.Id.ToString(),
            ct: ct);

        return GetInvoicesQueryHandler.MapToDetailDto(invoice);
    }
}
