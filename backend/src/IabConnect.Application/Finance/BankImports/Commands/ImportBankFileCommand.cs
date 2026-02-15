using IabConnect.Application.Finance.BankImports.Queries;
using MediatR;

namespace IabConnect.Application.Finance.BankImports.Commands;

public sealed record BankImportRowInput(
    DateTime TransactionDate, string Description,
    decimal Amount, string? Iban, string? Reference);

/// <summary>
/// Command to import bank CSV data (REQ-041)
/// </summary>
public sealed record ImportBankFileCommand : IRequest<BankImportDto>
{
    public required string FileName { get; init; }
    public required List<BankImportRowInput> Rows { get; init; }
    public required string UserName { get; init; }
}
