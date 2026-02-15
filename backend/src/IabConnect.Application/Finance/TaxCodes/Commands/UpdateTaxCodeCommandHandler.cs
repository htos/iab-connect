using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.TaxCodes.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

public sealed class UpdateTaxCodeCommandHandler : IRequestHandler<UpdateTaxCodeCommand, TaxCodeDto?>
{
    private readonly ITaxCodeRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateTaxCodeCommandHandler(
        ITaxCodeRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<TaxCodeDto?> Handle(UpdateTaxCodeCommand request, CancellationToken ct)
    {
        var taxCode = await _repository.GetByIdAsync(request.Id, ct);
        if (taxCode is null) return null;

        taxCode.Update(request.Code, request.Label, request.Rate, request.IsDefault, request.IsActive);
        await _repository.UpdateAsync(taxCode, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Tax code '{taxCode.Code}' updated",
            entityType: "TaxCode",
            entityId: taxCode.Id.ToString(),
            ct: ct);

        return GetTaxCodesQueryHandler.MapToDto(taxCode);
    }
}
