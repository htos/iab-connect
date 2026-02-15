using IabConnect.Application.Finance.Categories.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

/// <summary>
/// Command to update a transaction category (REQ-038)
/// </summary>
public sealed record UpdateCategoryCommand : IRequest<CategoryDto?>
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required string Color { get; init; }
}
