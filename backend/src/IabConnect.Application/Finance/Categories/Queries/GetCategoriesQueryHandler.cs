using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Queries;

public sealed class GetCategoriesQueryHandler : IRequestHandler<GetCategoriesQuery, PagedResult<CategoryDto>>
{
    private readonly ICategoryRepository _repository;

    public GetCategoriesQueryHandler(ICategoryRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken ct)
    {
        var categories = await _repository.GetAllAsync(ct);
        var dtos = categories.Select(c => new CategoryDto(
            c.Id, c.Name, c.Type.ToString(), c.Color,
            c.IsActive, c.CreatedAt, c.CreatedBy));

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "name", false);
        var sorted = field.ToLowerInvariant() switch
        {
            "createdat" => dtos.ApplySort(c => c.CreatedAt, desc),
            _ => dtos.ApplySort(c => c.Name, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }
}
