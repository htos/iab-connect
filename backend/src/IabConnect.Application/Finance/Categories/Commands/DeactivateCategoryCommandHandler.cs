using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Categories.Queries;
using IabConnect.Domain.Audit;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

public sealed class DeactivateCategoryCommandHandler : IRequestHandler<DeactivateCategoryCommand, CategoryDto?>
{
    private readonly ICategoryRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public DeactivateCategoryCommandHandler(
        ICategoryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<CategoryDto?> Handle(DeactivateCategoryCommand request, CancellationToken ct)
    {
        var category = await _repository.GetByIdAsync(request.Id, ct);
        if (category is null) return null;

        category.Deactivate();

        await _repository.UpdateAsync(category, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceUpdated,
            $"Category '{category.Name}' deactivated",
            entityType: "Category",
            entityId: category.Id.ToString(),
            ct: ct);

        return new CategoryDto(
            category.Id, category.Name, category.Type.ToString(), category.Color,
            category.IsActive, category.CreatedAt, category.CreatedBy);
    }
}
