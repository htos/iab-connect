using IabConnect.Application.Common;
using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Queries;

public sealed class GetActivityAreasQueryHandler : IRequestHandler<GetActivityAreasQuery, PagedResult<ActivityAreaDto>>
{
    private readonly IActivityAreaRepository _repository;

    public GetActivityAreasQueryHandler(IActivityAreaRepository repository)
    {
        _repository = repository;
    }

    public async Task<PagedResult<ActivityAreaDto>> Handle(GetActivityAreasQuery request, CancellationToken ct)
    {
        var areas = await _repository.GetAllActiveAsync(ct);
        var dtos = areas.Select(MapToDto);

        var (field, desc) = PaginationHelper.ParseSort(request.Sort, "sortOrder", false);
        var sorted = field.ToLowerInvariant() switch
        {
            "name" => dtos.ApplySort(a => a.Name, desc),
            "code" => dtos.ApplySort(a => a.Code, desc),
            _ => dtos.ApplySort(a => a.SortOrder, desc)
        };

        return sorted.ToPagedResult(request.Page, request.PageSize);
    }

    internal static ActivityAreaDto MapToDto(ActivityArea a) =>
        new(a.Id, a.Name, a.Code, a.Description, a.Color, a.IsActive, a.SortOrder);
}
