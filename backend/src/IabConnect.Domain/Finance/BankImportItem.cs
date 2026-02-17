using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-041: Individual bank transaction row from CSV import.
/// </summary>
public class BankImportItem : Entity
{
    public Guid BankImportId { get; private set; }
    public DateTime TransactionDate { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public string? Iban { get; private set; }
    public string? Reference { get; private set; }
    public BankImportItemStatus Status { get; private set; } = BankImportItemStatus.Unmatched;
    public Guid? MatchedPaymentId { get; private set; }

    // REQ-069: ISO 20022 reference fields
    public string? EndToEndId { get; private set; }
    public string? CreditorReference { get; private set; }
    public string? RemittanceInfo { get; private set; }
    public string? DebtorName { get; private set; }
    public string? DebtorIban { get; private set; }
    public Guid? SuggestedInvoiceId { get; private set; }
    public decimal? MatchConfidence { get; private set; }

    private BankImportItem() { }

    public static BankImportItem Create(
        Guid bankImportId,
        DateTime transactionDate,
        string description,
        decimal amount,
        string? iban,
        string? reference)
    {
        return new BankImportItem
        {
            BankImportId = bankImportId,
            TransactionDate = DateTime.SpecifyKind(transactionDate, DateTimeKind.Utc),
            Description = description,
            Amount = amount,
            Iban = iban,
            Reference = reference
        };
    }

    /// <summary>
    /// REQ-069: Sets ISO 20022 camt reference fields parsed from the XML.
    /// </summary>
    public void SetCamtFields(
        string? endToEndId,
        string? creditorReference,
        string? remittanceInfo,
        string? debtorName,
        string? debtorIban)
    {
        EndToEndId = endToEndId;
        CreditorReference = creditorReference;
        RemittanceInfo = remittanceInfo;
        DebtorName = debtorName;
        DebtorIban = debtorIban;
    }

    /// <summary>
    /// REQ-069: Sets the auto-match suggestion from the matcher.
    /// </summary>
    public void SetMatchSuggestion(Guid invoiceId, decimal confidence)
    {
        SuggestedInvoiceId = invoiceId;
        MatchConfidence = confidence;
    }

    public void MatchToPayment(Guid paymentId)
    {
        MatchedPaymentId = paymentId;
        Status = BankImportItemStatus.Matched;
    }

    public void Ignore()
    {
        Status = BankImportItemStatus.Ignored;
        MatchedPaymentId = null;
    }

    public void Unmatch()
    {
        Status = BankImportItemStatus.Unmatched;
        MatchedPaymentId = null;
    }
}
