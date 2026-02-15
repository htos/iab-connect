using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-039: Invoice line item (Rechnungsposten).
/// REQ-062: Extended with per-item tax code, net/gross calculation.
/// </summary>
public class InvoiceItem : Entity
{
    public Guid InvoiceId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Amount { get; private set; }

    // REQ-062: VAT fields
    public Guid? TaxCodeId { get; private set; }
    public decimal? TaxRate { get; private set; }
    public decimal? TaxAmount { get; private set; }
    public decimal? NetAmount { get; private set; }
    public decimal? GrossAmount { get; private set; }
    public bool IsGrossEntry { get; private set; }

    private InvoiceItem() { }

    public static InvoiceItem Create(Guid invoiceId, string description, decimal quantity, decimal unitPrice)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));

        return new InvoiceItem
        {
            InvoiceId = invoiceId,
            Description = description.Trim(),
            Quantity = quantity,
            UnitPrice = unitPrice,
            Amount = Math.Round(quantity * unitPrice, 2)
        };
    }

    public static InvoiceItem CreateWithTax(
        Guid invoiceId,
        string description,
        decimal quantity,
        decimal unitPrice,
        Guid? taxCodeId,
        decimal? taxRate,
        bool isGrossEntry)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required.", nameof(description));

        var item = new InvoiceItem
        {
            InvoiceId = invoiceId,
            Description = description.Trim(),
            Quantity = quantity,
            UnitPrice = unitPrice,
            TaxCodeId = taxCodeId,
            TaxRate = taxRate,
            IsGrossEntry = isGrossEntry
        };
        item.RecalculateAmounts();
        return item;
    }

    public void Update(string description, decimal quantity, decimal unitPrice)
    {
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        Amount = Math.Round(quantity * unitPrice, 2);
    }

    public void UpdateWithTax(
        string description,
        decimal quantity,
        decimal unitPrice,
        Guid? taxCodeId,
        decimal? taxRate,
        bool isGrossEntry)
    {
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        TaxCodeId = taxCodeId;
        TaxRate = taxRate;
        IsGrossEntry = isGrossEntry;
        RecalculateAmounts();
    }

    private void RecalculateAmounts()
    {
        var lineTotal = Math.Round(Quantity * UnitPrice, 2);
        var rate = TaxRate ?? 0m;

        if (IsGrossEntry && rate > 0)
        {
            // UnitPrice is gross — derive net from gross
            GrossAmount = lineTotal;
            NetAmount = Math.Round(lineTotal / (1 + rate), 2);
            TaxAmount = GrossAmount.Value - NetAmount.Value;
        }
        else
        {
            // UnitPrice is net (default)
            NetAmount = lineTotal;
            TaxAmount = Math.Round(lineTotal * rate, 2);
            GrossAmount = NetAmount.Value + TaxAmount.Value;
        }

        // Keep Amount consistent (always equals the line total as entered)
        Amount = lineTotal;
    }
}
