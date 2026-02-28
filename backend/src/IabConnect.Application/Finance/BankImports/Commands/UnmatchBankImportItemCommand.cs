using IabConnect.Application.Finance.BankImports.Queries;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

/// <summary>
/// Command to unmatch a bank import item, reversing a previous match (REQ-041)
/// </summary>
public sealed record UnmatchBankImportItemCommand(Guid BankImportId, Guid ItemId, string UserName)
    : IRequest<BankImportItemDto?>;
