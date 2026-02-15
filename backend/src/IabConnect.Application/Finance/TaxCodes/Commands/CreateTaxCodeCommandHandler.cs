using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.TaxCodes.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

public sealed class CreateTaxCodeCommandHandler : IRequestHandler<CreateTaxCodeCommand, TaxCodeDto>
{
    private readonly ITaxCodeRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateTaxCodeCommandHandler(
        ITaxCodeRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<TaxCodeDto> Handle(CreateTaxCodeCommand request, CancellationToken ct)
    {
        var taxCode = TaxCode.Create(request.Code, request.Label, request.Rate, request.IsDefault);
        await _repository.AddAsync(taxCode, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Tax code '{taxCode.Code}' created ({taxCode.Rate:P1})",
            entityType: "TaxCode",
            entityId: taxCode.Id.ToString(),
            ct: ct);

        return GetTaxCodesQueryHandler.MapToDto(taxCode);
    }
}
