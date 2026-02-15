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
