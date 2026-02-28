using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Queries;

/// <summary>
/// REQ-068: Shared DTO for activity area data
/// </summary>
public sealed record ActivityAreaDto(
    Guid Id, string Name, string Code, string? Description, string? Color, bool IsActive, int SortOrder);

/// <summary>
/// REQ-068: Query to get all active activity areas with pagination
/// </summary>
public sealed record GetActivityAreasQuery : IRequest<PagedResult<ActivityAreaDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
