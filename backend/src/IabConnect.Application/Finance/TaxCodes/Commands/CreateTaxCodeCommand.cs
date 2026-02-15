using IabConnect.Application.Finance.TaxCodes.Queries;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

/// <summary>
/// Command to create a tax code (REQ-062)
/// </summary>
public sealed record CreateTaxCodeCommand : IRequest<TaxCodeDto>
{
    public required string Code { get; init; }
    public required string Label { get; init; }
    public required decimal Rate { get; init; }
    public required bool IsDefault { get; init; }
}
