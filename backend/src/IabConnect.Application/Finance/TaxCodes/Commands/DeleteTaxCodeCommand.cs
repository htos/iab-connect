using MediatR;

namespace IabConnect.Application.Finance.TaxCodes.Commands;

/// <summary>
/// Command to soft-delete a tax code (REQ-062)
/// </summary>
public sealed record DeleteTaxCodeCommand(Guid Id) : IRequest<bool>;
