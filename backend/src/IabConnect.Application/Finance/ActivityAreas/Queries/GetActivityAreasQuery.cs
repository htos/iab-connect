using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Queries;

/// <summary>
/// REQ-068: Shared DTO for activity area data
/// </summary>
public sealed record ActivityAreaDto(
    Guid Id, string Name, string Code, string? Description, string? Color, bool IsActive, int SortOrder);

/// <summary>
/// REQ-068: Query to get all active activity areas
/// </summary>
public sealed record GetActivityAreasQuery : IRequest<List<ActivityAreaDto>>;
