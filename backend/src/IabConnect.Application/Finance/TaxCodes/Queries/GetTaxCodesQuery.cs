using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Queries;

public sealed record TaxCodeDto(
    Guid Id, string Code, string Label, decimal Rate, bool IsDefault,
    bool IsActive, DateTime CreatedAt, DateTime? UpdatedAt);

/// <summary>
/// Query to get all active tax codes (REQ-062)
/// </summary>
public sealed record GetTaxCodesQuery : IRequest<List<TaxCodeDto>>;
