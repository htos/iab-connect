using MediatR;

namespace IabConnect.Application.Finance.BankImports.Queries;

public sealed record BankImportDto(
    Guid Id, DateTime ImportDate, string FileName,
    string Status, string ImportedBy, string Format,
    List<BankImportItemDto> Items);

public sealed record BankImportItemDto(
    Guid Id, DateTime TransactionDate, string Description,
    decimal Amount, string? Iban, string? Reference,
    string Status, Guid? MatchedPaymentId,
    string? EndToEndId, string? CreditorReference,
    string? RemittanceInfo, string? DebtorName, string? DebtorIban,
    Guid? SuggestedInvoiceId, decimal? MatchConfidence);

/// <summary>
/// Query to get all bank imports (REQ-041)
/// </summary>
public sealed record GetBankImportsQuery : IRequest<List<BankImportDto>>;
