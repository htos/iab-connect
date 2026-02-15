using MediatR;

namespace IabConnect.Application.Finance.BankImports.Queries;

public sealed record BankImportDto(
    Guid Id, DateTime ImportDate, string FileName,
    string Status, string ImportedBy, List<BankImportItemDto> Items);

public sealed record BankImportItemDto(
    Guid Id, DateTime TransactionDate, string Description,
    decimal Amount, string? Iban, string? Reference,
    string Status, Guid? MatchedPaymentId);

/// <summary>
/// Query to get all bank imports (REQ-041)
/// </summary>
public sealed record GetBankImportsQuery : IRequest<List<BankImportDto>>;
