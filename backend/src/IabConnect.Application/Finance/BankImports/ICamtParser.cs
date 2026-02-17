namespace IabConnect.Application.Finance.BankImports;

/// <summary>
/// REQ-069: Parses ISO 20022 camt.053/054 XML files into structured entries.
/// </summary>
public interface ICamtParser
{
    /// <summary>
    /// Parses a camt.053 or camt.054 XML stream and returns structured entries.
    /// </summary>
    Task<CamtParseResult> ParseAsync(Stream xmlStream, CancellationToken ct = default);
}

public sealed record CamtParseResult(
    string MessageId,
    string? StatementId,
    DateTime? CreationDate,
    string? AccountIban,
    List<CamtEntry> Entries);

public sealed record CamtEntry(
    DateTime BookingDate,
    DateTime? ValueDate,
    decimal Amount,
    string Currency,
    string? CreditDebitIndicator, // CRDT or DBIT
    string? EndToEndId,
    string? CreditorReference,
    string? RemittanceInfo,
    string? DebtorName,
    string? DebtorIban,
    string? CreditorName,
    string? CreditorIban,
    string? BankTransactionCode,
    string? Description);
