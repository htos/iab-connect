using IabConnect.Domain.Finance;

namespace IabConnect.Application.Finance.BankImports;

/// <summary>
/// REQ-069: Auto-matches bank import items against open invoices.
/// </summary>
public interface IBankImportMatcher
{
    Task<List<MatchSuggestion>> FindMatchesAsync(List<BankImportItem> items, CancellationToken ct = default);
}

public sealed record MatchSuggestion(
    Guid BankImportItemId,
    Guid InvoiceId,
    string InvoiceNumber,
    decimal Confidence, // 0.0-1.0
    string MatchReason); // e.g., "Reference match", "Amount+date match"
