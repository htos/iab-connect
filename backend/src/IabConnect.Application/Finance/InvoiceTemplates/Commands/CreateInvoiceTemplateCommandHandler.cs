using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.InvoiceTemplates.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

public sealed class CreateInvoiceTemplateCommandHandler : IRequestHandler<CreateInvoiceTemplateCommand, InvoiceTemplateDto>
{
    private readonly IInvoiceTemplateRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateInvoiceTemplateCommandHandler(
        IInvoiceTemplateRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<InvoiceTemplateDto> Handle(CreateInvoiceTemplateCommand request, CancellationToken ct)
    {
        var jurisdiction = Enum.Parse<Jurisdiction>(request.Jurisdiction, ignoreCase: true);

        var template = InvoiceTemplate.Create(
            request.Name,
            jurisdiction,
            request.CountryCode,
            request.IsDefault,
            request.ShowVatId,
            request.ShowTaxExemptionNote,
            request.TaxExemptionNote,
            request.ShowReverseChargeNote,
            request.ReverseChargeNote,
            request.ShowPaymentTerms,
            request.DefaultPaymentTerms,
            request.ShowBankDetails,
            request.LogoUrl,
            request.HeaderText,
            request.FooterText,
            request.LegalNotice,
            request.Language);

        await _repository.AddAsync(template, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Invoice template '{template.Name}' created (Jurisdiction: {template.Jurisdiction})",
            entityType: "InvoiceTemplate",
            entityId: template.Id.ToString(),
            ct: ct);

        return GetInvoiceTemplatesQueryHandler.MapToDto(template);
    }
}
