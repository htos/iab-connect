using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-039: Invoice (Rechnung) for members, sponsors, vendors.
/// REQ-062: Extended with per-item VAT totals.
/// </summary>
public class Invoice : Entity, ISoftDeletable
{
    public string InvoiceNumber { get; private set; } = string.Empty;
    public DateTime Date { get; private set; }
    public DateTime DueDate { get; private set; }
    public InvoiceStatus Status { get; private set; } = InvoiceStatus.Draft;
    public RecipientType RecipientType { get; private set; }
    public Guid? RecipientId { get; private set; }
    public string RecipientName { get; private set; } = string.Empty;
    public string? RecipientAddress { get; private set; }
    public decimal SubTotal { get; private set; }
    public decimal TaxRate { get; private set; }
    public decimal TaxAmount { get; private set; }
    public decimal Total { get; private set; }
    public string? Notes { get; private set; }
    public string? CancellationReason { get; private set; }
    public DateTime? CancelledAt { get; private set; }

    // REQ-062: VAT aggregate totals
    public decimal SubtotalNet { get; private set; }
    public decimal TotalTax { get; private set; }
    public decimal TotalGross { get; private set; }

    // REQ-064: EU compliance fields
    public string? PaymentTerms { get; private set; }
    public Guid? TemplateId { get; private set; }

    private readonly List<InvoiceItem> _items = [];
    public IReadOnlyList<InvoiceItem> Items => _items.AsReadOnly();

    public DateTime CreatedAt { get; private set; }
    public string CreatedBy { get; private set; } = string.Empty;
    public DateTime? UpdatedAt { get; private set; }
    public string? UpdatedBy { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }
    public string? DeletedBy { get; private set; }

    private Invoice() { }

    public static Invoice Create(
        string invoiceNumber,
        DateTime date,
        DateTime dueDate,
        RecipientType recipientType,
        Guid? recipientId,
        string recipientName,
        string? recipientAddress,
        decimal taxRate,
        string? notes,
        string createdBy,
        string? paymentTerms = null,
        Guid? templateId = null)
    {
        if (string.IsNullOrWhiteSpace(invoiceNumber))
            throw new ArgumentException("Invoice number is required.", nameof(invoiceNumber));
        if (string.IsNullOrWhiteSpace(recipientName))
            throw new ArgumentException("Recipient name is required.", nameof(recipientName));

        return new Invoice
        {
            InvoiceNumber = invoiceNumber.Trim(),
            Date = DateTime.SpecifyKind(date, DateTimeKind.Utc),
            DueDate = DateTime.SpecifyKind(dueDate, DateTimeKind.Utc),
            RecipientType = recipientType,
            RecipientId = recipientId,
            RecipientName = recipientName.Trim(),
            RecipientAddress = recipientAddress?.Trim(),
            TaxRate = taxRate,
            Notes = notes?.Trim(),
            PaymentTerms = paymentTerms?.Trim(),
            TemplateId = templateId,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy
        };
    }

    public void Update(
        DateTime date,
        DateTime dueDate,
        RecipientType recipientType,
        Guid? recipientId,
        string recipientName,
        string? recipientAddress,
        decimal taxRate,
        string? notes,
        string updatedBy,
        string? paymentTerms = null,
        Guid? templateId = null)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only draft invoices can be edited.");

        Date = DateTime.SpecifyKind(date, DateTimeKind.Utc);
        DueDate = DateTime.SpecifyKind(dueDate, DateTimeKind.Utc);
        RecipientType = recipientType;
        RecipientId = recipientId;
        RecipientName = recipientName.Trim();
        RecipientAddress = recipientAddress?.Trim();
        TaxRate = taxRate;
        Notes = notes?.Trim();
        PaymentTerms = paymentTerms?.Trim();
        TemplateId = templateId;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
        RecalculateTotals();
    }

    public void AddItem(string description, decimal quantity, decimal unitPrice)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only draft invoices can be modified.");

        var item = InvoiceItem.Create(Id, description, quantity, unitPrice);
        _items.Add(item);
        RecalculateTotals();
    }

    public void AddItemWithTax(
        string description,
        decimal quantity,
        decimal unitPrice,
        Guid? taxCodeId,
        decimal? taxRate,
        bool isGrossEntry,
        Guid? activityAreaId = null)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only draft invoices can be modified.");

        var item = InvoiceItem.CreateWithTax(Id, description, quantity, unitPrice, taxCodeId, taxRate, isGrossEntry, activityAreaId);
        _items.Add(item);
        RecalculateTotals();
    }

    public void RemoveItem(Guid itemId)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only draft invoices can be modified.");

        var item = _items.FirstOrDefault(i => i.Id == itemId);
        if (item != null)
        {
            _items.Remove(item);
            RecalculateTotals();
        }
    }

    public void SetItems(List<InvoiceItem> items)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only draft invoices can be modified.");

        _items.Clear();
        _items.AddRange(items);
        RecalculateTotals();
    }

    public void MarkAsSent(string updatedBy)
    {
        if (Status != InvoiceStatus.Draft)
            throw new InvalidOperationException("Only draft invoices can be sent.");

        Status = InvoiceStatus.Sent;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void MarkAsPaid(string updatedBy)
    {
        if (Status is InvoiceStatus.Cancelled or InvoiceStatus.Paid)
            throw new InvalidOperationException("Cannot mark cancelled or already paid invoice as paid.");

        Status = InvoiceStatus.Paid;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void MarkAsOverdue(string updatedBy)
    {
        if (Status != InvoiceStatus.Sent)
            throw new InvalidOperationException("Only sent invoices can be marked as overdue.");

        Status = InvoiceStatus.Overdue;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// Recalculates the payment status based on total paid amount.
    /// Used when payments are deleted or updated to maintain invoice-payment consistency.
    /// </summary>
    public void RecalculatePaymentStatus(decimal totalPaidAmount, string updatedBy)
    {
        if (Status is InvoiceStatus.Draft or InvoiceStatus.Cancelled)
            return; // Don't touch draft or cancelled invoices

        if (totalPaidAmount >= Total)
        {
            if (Status is not InvoiceStatus.Paid)
            {
                Status = InvoiceStatus.Paid;
                UpdatedAt = DateTime.UtcNow;
                UpdatedBy = updatedBy;
            }
        }
        else
        {
            if (Status is InvoiceStatus.Paid)
            {
                Status = InvoiceStatus.Sent;
                UpdatedAt = DateTime.UtcNow;
                UpdatedBy = updatedBy;
            }
        }
    }

    public void Cancel(string reason, string updatedBy)
    {
        if (Status is not (InvoiceStatus.Sent or InvoiceStatus.Overdue))
            throw new InvalidOperationException("Only sent or overdue invoices can be cancelled. Use delete for draft invoices.");

        if (string.IsNullOrWhiteSpace(reason))
            throw new ArgumentException("Cancellation reason is required.", nameof(reason));

        Status = InvoiceStatus.Cancelled;
        CancellationReason = reason.Trim();
        CancelledAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    public void SoftDelete(string? deletedBy = null)
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        DeletedBy = deletedBy;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
        DeletedBy = null;
    }

    private void RecalculateTotals()
    {
        SubTotal = _items.Sum(i => i.Amount);
        TaxAmount = Math.Round(SubTotal * TaxRate / 100, 2);

        // REQ-062: Compute VAT aggregate totals from per-item tax data
        SubtotalNet = _items.Sum(i => i.NetAmount ?? i.Amount);
        TotalTax = _items.Sum(i => i.TaxAmount ?? 0m);
        TotalGross = _items.Sum(i => i.GrossAmount ?? i.Amount);

        // Total equals TotalGross when per-item tax is used, otherwise legacy calculation
        Total = TotalGross > 0 ? TotalGross : SubTotal + TaxAmount;
    }
}
