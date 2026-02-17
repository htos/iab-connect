using IabConnect.Application.Finance.ActivityAreas.Queries;
using MediatR;

namespace IabConnect.Application.Finance.ActivityAreas.Commands;

/// <summary>
/// REQ-068: Command to update an activity area
/// </summary>
public sealed record UpdateActivityAreaCommand : IRequest<ActivityAreaDto?>
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Code { get; init; }
    public string? Description { get; init; }
    public string? Color { get; init; }
    public int SortOrder { get; init; }
    public bool IsActive { get; init; } = true;
}
