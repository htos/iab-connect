using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.ActivityAreas.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

public sealed class CreateActivityAreaCommandHandler : IRequestHandler<CreateActivityAreaCommand, ActivityAreaDto>
{
    private readonly IActivityAreaRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateActivityAreaCommandHandler(
        IActivityAreaRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ActivityAreaDto> Handle(CreateActivityAreaCommand request, CancellationToken ct)
    {
        var area = ActivityArea.Create(
            request.Name, request.Code, request.Description, request.Color, request.SortOrder);

        await _repository.AddAsync(area, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Activity area '{area.Code}' ({area.Name}) created",
            entityType: "ActivityArea",
            entityId: area.Id.ToString(),
            ct: ct);

        return GetActivityAreasQueryHandler.MapToDto(area);
    }
}
