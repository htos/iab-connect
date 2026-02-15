using IabConnect.Application.Finance.BankImports.Queries;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

/// <summary>
/// Command to ignore a bank import item (REQ-041)
/// </summary>
public sealed record IgnoreBankImportItemCommand(Guid BankImportId, Guid ItemId)
    : IRequest<BankImportItemDto?>;
