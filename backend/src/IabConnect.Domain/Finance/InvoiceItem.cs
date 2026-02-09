using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-039: Invoice line item (Rechnungsposten).
/// </summary>
public class InvoiceItem : Entity
{
    public Guid InvoiceId { get; private set; }
    public string Description { get; private set; } = string.Empty;
    public decimal Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Amount { get; private set; }

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

    public void Update(string description, decimal quantity, decimal unitPrice)
    {
        Description = description.Trim();
        Quantity = quantity;
        UnitPrice = unitPrice;
        Amount = Math.Round(quantity * unitPrice, 2);
    }
}
