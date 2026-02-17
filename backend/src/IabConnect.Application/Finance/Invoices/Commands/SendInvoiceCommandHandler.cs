using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Invoices.Commands;

public sealed class SendInvoiceCommandHandler : IRequestHandler<SendInvoiceCommand, InvoiceDetailDto?>
{
    private readonly IInvoiceRepository _repository;
    private readonly IFinanceProfileRepository _profileRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public SendInvoiceCommandHandler(
        IInvoiceRepository repository,
        IFinanceProfileRepository profileRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _profileRepository = profileRepository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<InvoiceDetailDto?> Handle(SendInvoiceCommand request, CancellationToken ct)
    {
        var invoice = await _repository.GetByIdAsync(request.Id, ct);
        if (invoice is null) return null;

        // REQ-064: EU compliance validation before sending
        var profile = await _profileRepository.GetActiveProfileAsync(ct);
        if (profile is { Jurisdiction: Jurisdiction.EU })
        {
            ValidateEuCompliance(invoice, profile);
        }

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

    /// <summary>
    /// REQ-064: Validates EU compliance requirements before an invoice can be sent.
    /// </summary>
    private static void ValidateEuCompliance(Invoice invoice, FinanceProfile profile)
    {
        var errors = new List<string>();

        // If VAT-registered, VAT number must be set on profile
        if (profile.VatStatus == VatStatus.Registered && string.IsNullOrWhiteSpace(profile.VatNumber))
        {
            errors.Add("EU compliance: Finance profile is VAT-registered but has no VAT number configured.");
        }

        // All invoice items should have tax codes assigned for EU invoices
        var itemsWithoutTaxCode = invoice.Items.Where(i => !i.TaxCodeId.HasValue).ToList();
        if (itemsWithoutTaxCode.Count > 0)
        {
            errors.Add($"EU compliance: {itemsWithoutTaxCode.Count} invoice item(s) have no tax code assigned.");
        }

        if (errors.Count > 0)
        {
            throw new InvalidOperationException(
                $"Cannot send invoice: {string.Join(" ", errors)}");
        }
    }
}
