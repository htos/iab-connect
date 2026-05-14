namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-039: Configuration for invoice PDF generation.
/// </summary>
public sealed class InvoiceSettings
{
    public const string SectionName = "InvoiceSettings";

    // REQ-086 (E9-S3): neutral code-level defaults — the deployment supplies the real
    // organization identity via appsettings (InvoiceSettings:*).
    public string OrganizationName { get; set; } = "Your Organization";
    public string OrganizationAddress { get; set; } = "Musterstrasse 1, 8000 Zürich";
    public string OrganizationEmail { get; set; } = "info@example.org";
    public string PaymentInstructions { get; set; } = "Please transfer the amount to our bank account.";
    public string Currency { get; set; } = "CHF";
    public int DefaultPaymentTermDays { get; set; } = 30;
}
