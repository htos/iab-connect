using IabConnect.Application.Finance.Categories.Queries;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Commands;

/// <summary>
/// Command to create a transaction category (REQ-038)
/// </summary>
public sealed record CreateCategoryCommand : IRequest<CategoryDto>
{
    public required string Name { get; init; }
    public required string Type { get; init; }
    public required string Color { get; init; }
    public required string UserName { get; init; }
}
