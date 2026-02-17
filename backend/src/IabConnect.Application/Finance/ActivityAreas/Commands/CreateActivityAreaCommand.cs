using IabConnect.Application.Finance.ActivityAreas.Queries;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

/// <summary>
/// REQ-068: Command to create an activity area
/// </summary>
public sealed record CreateActivityAreaCommand : IRequest<ActivityAreaDto>
{
    public required string Name { get; init; }
    public required string Code { get; init; }
    public string? Description { get; init; }
    public string? Color { get; init; }
    public int SortOrder { get; init; }
}
