using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.InvoiceTemplates.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

public sealed class UpdateInvoiceTemplateCommandHandler : IRequestHandler<UpdateInvoiceTemplateCommand, InvoiceTemplateDto?>
{
    private readonly IInvoiceTemplateRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateInvoiceTemplateCommandHandler(
        IInvoiceTemplateRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<InvoiceTemplateDto?> Handle(UpdateInvoiceTemplateCommand request, CancellationToken ct)
    {
        var template = await _repository.GetByIdAsync(request.Id, ct);
        if (template is null) return null;

        template.Update(
            request.Name, request.IsDefault, request.ShowVatId, request.ShowTaxExemptionNote,
            request.TaxExemptionNote, request.ShowReverseChargeNote, request.ReverseChargeNote,
            request.ShowPaymentTerms, request.DefaultPaymentTerms, request.ShowBankDetails,
            request.LogoUrl, request.HeaderText, request.FooterText, request.LegalNotice,
            request.Language);

        await _repository.UpdateAsync(template, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Invoice template '{template.Name}' updated",
            entityType: "InvoiceTemplate",
            entityId: template.Id.ToString(),
            ct: ct);

        return GetInvoiceTemplatesQueryHandler.MapToDto(template);
    }
}
