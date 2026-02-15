using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance.Categories.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

public sealed class CreateCategoryCommandHandler : IRequestHandler<CreateCategoryCommand, CategoryDto>
{
    private readonly ICategoryRepository _repository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public CreateCategoryCommandHandler(
        ICategoryRepository repository,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<CategoryDto> Handle(CreateCategoryCommand request, CancellationToken ct)
    {
        var txType = Enum.Parse<TransactionType>(request.Type, ignoreCase: true);
        var category = Category.Create(request.Name, txType, request.Color, request.UserName);

        await _repository.AddAsync(category, ct);
        await _unitOfWork.SaveChangesAsync(ct);

        await _auditService.LogActionAsync(
            AuditEventType.FinanceCreated,
            $"Category '{category.Name}' created",
            entityType: "Category",
            entityId: category.Id.ToString(),
            ct: ct);

        return new CategoryDto(category.Id, category.Name, category.Type.ToString(),
            category.Color, category.IsActive, category.CreatedAt, category.CreatedBy);
    }
}
