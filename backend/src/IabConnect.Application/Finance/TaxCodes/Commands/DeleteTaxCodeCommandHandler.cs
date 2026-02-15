using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

public sealed class DeleteTaxCodeCommandHandler : IRequestHandler<DeleteTaxCodeCommand, bool>
{
    private readonly ITaxCodeRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteTaxCodeCommandHandler(
        ITaxCodeRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteTaxCodeCommand request, CancellationToken ct)
    {
        var taxCode = await _repository.GetByIdAsync(request.Id, ct);
        if (taxCode is null) return false;

        taxCode.SoftDelete();
        await _repository.UpdateAsync(taxCode, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Tax code '{taxCode.Code}' soft-deleted",
            entityType: "TaxCode",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
