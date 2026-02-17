using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.ActivityAreas.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

public sealed class UpdateActivityAreaCommandHandler : IRequestHandler<UpdateActivityAreaCommand, ActivityAreaDto?>
{
    private readonly IActivityAreaRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateActivityAreaCommandHandler(
        IActivityAreaRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ActivityAreaDto?> Handle(UpdateActivityAreaCommand request, CancellationToken ct)
    {
        var area = await _repository.GetByIdAsync(request.Id, ct);
        if (area is null) return null;

        area.Update(request.Name, request.Code, request.Description, request.Color, request.SortOrder, request.IsActive);
        await _repository.UpdateAsync(area, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Activity area '{area.Code}' updated",
            entityType: "ActivityArea",
            entityId: area.Id.ToString(),
            ct: ct);

        return GetActivityAreasQueryHandler.MapToDto(area);
    }
}
