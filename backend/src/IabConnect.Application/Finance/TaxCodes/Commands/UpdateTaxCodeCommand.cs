using IabConnect.Application.Finance.TaxCodes.Queries;
using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

/// <summary>
/// Command to update an existing tax code (REQ-062)
/// </summary>
public sealed record UpdateTaxCodeCommand : IRequest<TaxCodeDto?>
{
    public required Guid Id { get; init; }
    public required string Code { get; init; }
    public required string Label { get; init; }
    public required decimal Rate { get; init; }
    public required bool IsDefault { get; init; }
    public required bool IsActive { get; init; }
}
