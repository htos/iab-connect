using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-064: Configurable invoice template per finance profile.
/// Stores EU-specific mandatory fields and optional presentation settings.
/// </summary>
public class InvoiceTemplate : Entity, ISoftDeletable
{
    public string Name { get; private set; } = string.Empty;
    public Jurisdiction Jurisdiction { get; private set; }
    public string? CountryCode { get; private set; }  // null = generic EU baseline
    public bool IsDefault { get; private set; }

    // EU mandatory fields configuration
    public bool ShowVatId { get; private set; } = true;
    public bool ShowTaxExemptionNote { get; private set; }
    public string? TaxExemptionNote { get; private set; }  // e.g., "Steuerbefreit nach §4 UStG"
    public bool ShowReverseChargeNote { get; private set; }
    public string? ReverseChargeNote { get; private set; }  // e.g., "Reverse charge applies"
    public bool ShowPaymentTerms { get; private set; } = true;
    public string? DefaultPaymentTerms { get; private set; }  // e.g., "Due within 30 days"
    public bool ShowBankDetails { get; private set; } = true;

    // Optional presentation
    public string? LogoUrl { get; private set; }
    public string? HeaderText { get; private set; }
    public string? FooterText { get; private set; }
    public string? LegalNotice { get; private set; }  // e.g., "Registered at..."

    // Template language (for i18n of invoice text)
    public string Language { get; private set; } = "en";  // ISO 639-1

    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    private InvoiceTemplate() { }

    public static InvoiceTemplate Create(
        string name,
        Jurisdiction jurisdiction,
        string? countryCode,
        bool isDefault,
        bool showVatId,
        bool showTaxExemptionNote,
        string? taxExemptionNote,
        bool showReverseChargeNote,
        string? reverseChargeNote,
        bool showPaymentTerms,
        string? defaultPaymentTerms,
        bool showBankDetails,
        string? logoUrl,
        string? headerText,
        string? footerText,
        string? legalNotice,
        string language)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));

        var now = DateTimeOffset.UtcNow;
        return new InvoiceTemplate
        {
            Name = name.Trim(),
            Jurisdiction = jurisdiction,
            CountryCode = countryCode?.Trim().ToUpperInvariant(),
            IsDefault = isDefault,
            ShowVatId = showVatId,
            ShowTaxExemptionNote = showTaxExemptionNote,
            TaxExemptionNote = taxExemptionNote?.Trim(),
            ShowReverseChargeNote = showReverseChargeNote,
            ReverseChargeNote = reverseChargeNote?.Trim(),
            ShowPaymentTerms = showPaymentTerms,
            DefaultPaymentTerms = defaultPaymentTerms?.Trim(),
            ShowBankDetails = showBankDetails,
            LogoUrl = logoUrl?.Trim(),
            HeaderText = headerText?.Trim(),
            FooterText = footerText?.Trim(),
            LegalNotice = legalNotice?.Trim(),
            Language = language.Trim(),
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Update(
        string name, bool isDefault, bool showVatId, bool showTaxExemptionNote,
        string? taxExemptionNote, bool showReverseChargeNote, string? reverseChargeNote,
        bool showPaymentTerms, string? defaultPaymentTerms, bool showBankDetails,
        string? logoUrl, string? headerText, string? footerText, string? legalNotice,
        string language)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Name is required.", nameof(name));

        Name = name.Trim();
        IsDefault = isDefault;
        ShowVatId = showVatId;
        ShowTaxExemptionNote = showTaxExemptionNote;
        TaxExemptionNote = taxExemptionNote?.Trim();
        ShowReverseChargeNote = showReverseChargeNote;
        ReverseChargeNote = reverseChargeNote?.Trim();
        ShowPaymentTerms = showPaymentTerms;
        DefaultPaymentTerms = defaultPaymentTerms?.Trim();
        ShowBankDetails = showBankDetails;
        LogoUrl = logoUrl?.Trim();
        HeaderText = headerText?.Trim();
        FooterText = footerText?.Trim();
        LegalNotice = legalNotice?.Trim();
        Language = language.Trim();
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void SoftDelete()
    {
        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
    }

    public void Restore()
    {
        IsDeleted = false;
        DeletedAt = null;
    }
}
