using IabConnect.Application.Finance;
using IabConnect.Application.Finance.BankImports;
using IabConnect.Domain.Finance;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-069: Auto-matches bank import items against open invoices.
/// Matching strategy (priority order):
/// 1. Exact EndToEndId match against invoice number → confidence 1.0
/// 2. CreditorReference match against invoice number → confidence 0.95
/// 3. RemittanceInfo contains invoice number → confidence 0.8
/// 4. Amount exact match + date within 30 days → confidence 0.6
/// 5. Amount exact match only → confidence 0.4
/// </summary>
public sealed class BankImportMatcher : IBankImportMatcher
{
    private readonly IInvoiceRepository _invoiceRepository;

    public BankImportMatcher(IInvoiceRepository invoiceRepository)
        => _invoiceRepository = invoiceRepository;

    public async Task<List<MatchSuggestion>> FindMatchesAsync(
        List<BankImportItem> items, CancellationToken ct = default)
    {
        var openInvoices = await _invoiceRepository.GetOpenItemsAsync(ct);
        var suggestions = new List<MatchSuggestion>();

        foreach (var item in items.Where(i => i.Status == BankImportItemStatus.Unmatched))
        {
            MatchSuggestion? best = null;

            foreach (var invoice in openInvoices)
            {
                // 1. EndToEndId exact match
                if (item.EndToEndId is not null &&
                    string.Equals(item.EndToEndId.Trim(), invoice.InvoiceNumber.Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    best = new(item.Id, invoice.Id, invoice.InvoiceNumber,
                        1.0m, "End-to-end ID matches invoice number");
                    break; // perfect match, stop searching
                }

                // 2. CreditorReference match
                if (item.CreditorReference is not null &&
                    string.Equals(item.CreditorReference.Trim(), invoice.InvoiceNumber.Trim(),
                        StringComparison.OrdinalIgnoreCase))
                {
                    var s = new MatchSuggestion(item.Id, invoice.Id, invoice.InvoiceNumber,
                        0.95m, "Creditor reference matches invoice number");
                    if (best is null || s.Confidence > best.Confidence) best = s;
                    continue;
                }

                // 3. RemittanceInfo contains invoice number
                if (item.RemittanceInfo is not null &&
                    item.RemittanceInfo.Contains(invoice.InvoiceNumber, StringComparison.OrdinalIgnoreCase))
                {
                    var s = new MatchSuggestion(item.Id, invoice.Id, invoice.InvoiceNumber,
                        0.8m, "Remittance info contains invoice number");
                    if (best is null || s.Confidence > best.Confidence) best = s;
                    continue;
                }

                // 4 & 5. Amount match (with optional date proximity)
                if (item.Amount == invoice.Total)
                {
                    var daysDiff = Math.Abs((item.TransactionDate - invoice.DueDate).TotalDays);
                    if (daysDiff <= 30)
                    {
                        var s = new MatchSuggestion(item.Id, invoice.Id, invoice.InvoiceNumber,
                            0.6m, $"Amount matches, date within {(int)daysDiff} days of due date");
                        if (best is null || s.Confidence > best.Confidence) best = s;
                    }
                    else
                    {
                        var s = new MatchSuggestion(item.Id, invoice.Id, invoice.InvoiceNumber,
                            0.4m, "Amount matches");
                        if (best is null || s.Confidence > best.Confidence) best = s;
                    }
                }
            }

            if (best is not null)
                suggestions.Add(best);
        }

        return suggestions;
    }
}
