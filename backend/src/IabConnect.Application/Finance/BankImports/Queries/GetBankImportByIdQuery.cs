using MediatR;

namespace IabConnect.Application.Finance.BankImports.Queries;

/// <summary>
/// Query to get a bank import by ID with items (REQ-041)
/// </summary>
public sealed record GetBankImportByIdQuery(Guid Id) : IRequest<BankImportDto?>;
