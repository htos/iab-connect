using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

public sealed class DeleteActivityAreaCommandHandler : IRequestHandler<DeleteActivityAreaCommand, bool>
{
    private readonly IActivityAreaRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeleteActivityAreaCommandHandler(
        IActivityAreaRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<bool> Handle(DeleteActivityAreaCommand request, CancellationToken ct)
    {
        var area = await _repository.GetByIdAsync(request.Id, ct);
        if (area is null) return false;

        area.SoftDelete();
        await _repository.UpdateAsync(area, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceDeleted,
            $"Activity area '{area.Code}' soft-deleted",
            entityType: "ActivityArea",
            entityId: request.Id.ToString(),
            ct: ct);

        return true;
    }
}
