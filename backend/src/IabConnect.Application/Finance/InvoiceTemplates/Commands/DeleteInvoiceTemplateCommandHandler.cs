using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.InvoiceTemplates.Commands;

public sealed class DeleteInvoiceTemplateCommandHandler : IRequestHandler<DeleteInvoiceTemplateCommand, bool>
{
    private readonly IInvoiceTemplateRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteInvoiceTemplateCommandHandler(
        IInvoiceTemplateRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteInvoiceTemplateCommand request, CancellationToken ct)
    {
        var template = await _repository.GetByIdAsync(request.Id, ct);
        if (template is null) return false;

        template.SoftDelete();
        await _repository.UpdateAsync(template, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Invoice template '{template.Name}' soft-deleted",
            entityType: "InvoiceTemplate",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
