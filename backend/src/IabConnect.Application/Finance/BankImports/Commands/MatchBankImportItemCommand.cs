using IabConnect.Application.Finance.BankImports.Queries;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

/// <summary>
/// Command to match a bank import item to a payment (REQ-041)
/// </summary>
public sealed record MatchBankImportItemCommand(Guid BankImportId, Guid ItemId, Guid PaymentId, string UserName)
    : IRequest<BankImportItemDto?>;
