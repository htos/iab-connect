using MediatR;

namespace IabConnect.Application.Finance.Categories.Queries;

public sealed class GetCategoriesQueryHandler : IRequestHandler<GetCategoriesQuery, List<CategoryDto>>
{
    private readonly ICategoryRepository _repository;

    public GetCategoriesQueryHandler(ICategoryRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<CategoryDto>> Handle(GetCategoriesQuery request, CancellationToken ct)
    {
        var categories = await _repository.GetAllAsync(ct);
        return categories.Select(c => new CategoryDto(
            c.Id, c.Name, c.Type.ToString(), c.Color,
            c.IsActive, c.CreatedAt, c.CreatedBy)).ToList();
    }
}
