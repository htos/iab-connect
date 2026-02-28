using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.Categories.Queries;

/// <summary>
/// Shared DTO for category data
/// </summary>
public sealed record CategoryDto(
    Guid Id, string Name, string Type, string Color,
    bool IsActive, DateTime CreatedAt, string CreatedBy);

/// <summary>
/// Query to get all transaction categories (REQ-038) with pagination support
/// </summary>
public sealed record GetCategoriesQuery : IRequest<PagedResult<CategoryDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
