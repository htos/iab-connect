namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-039: Configuration for invoice PDF generation.
/// </summary>
public sealed class InvoiceSettings
{
    public const string SectionName = "InvoiceSettings";

    public string OrganizationName { get; set; } = "Indisch-Asiatischer Bildungsverein";
    public string OrganizationAddress { get; set; } = "Musterstrasse 1, 8000 Zürich";
    public string OrganizationEmail { get; set; } = "info@iab-connect.ch";
    public string PaymentInstructions { get; set; } = "Please transfer the amount to our bank account.";
    public string Currency { get; set; } = "CHF";
    public int DefaultPaymentTermDays { get; set; } = 30;
}
