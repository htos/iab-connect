using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Queries;

public sealed record TaxCodeDto(
    Guid Id, string Code, string Label, decimal Rate, bool IsDefault,
    bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt);

/// <summary>
/// Query to get all active tax codes (REQ-062) with pagination support
/// </summary>
public sealed record GetTaxCodesQuery : IRequest<PagedResult<TaxCodeDto>>
{
    public int Page { get; init; } = 1;
    public int PageSize { get; init; } = 20;
    public string? Sort { get; init; }
    public string? Filter { get; init; }
}
