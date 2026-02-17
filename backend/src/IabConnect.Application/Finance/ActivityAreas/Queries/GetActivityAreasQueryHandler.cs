using IabConnect.Domain.Finance;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Queries;

public sealed class GetActivityAreasQueryHandler : IRequestHandler<GetActivityAreasQuery, List<ActivityAreaDto>>
{
    private readonly IActivityAreaRepository _repository;

    public GetActivityAreasQueryHandler(IActivityAreaRepository repository)
    {
        _repository = repository;
    }

    public async Task<List<ActivityAreaDto>> Handle(GetActivityAreasQuery request, CancellationToken ct)
    {
        var areas = await _repository.GetAllActiveAsync(ct);
        return areas.Select(MapToDto).ToList();
    }

    internal static ActivityAreaDto MapToDto(ActivityArea a) =>
        new(a.Id, a.Name, a.Code, a.Description, a.Color, a.IsActive, a.SortOrder);
}
