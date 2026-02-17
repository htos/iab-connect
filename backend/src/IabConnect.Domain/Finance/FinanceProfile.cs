using IabConnect.Domain.Common;

namespace IabConnect.Domain.Finance;

/// <summary>
/// REQ-060: Finance profile storing jurisdiction, currency, fiscal year start,
/// organization details, and bank information.
/// Only one active profile is allowed at a time.
/// </summary>
public class FinanceProfile : Entity
{
    public Jurisdiction Jurisdiction { get; private set; }
    public string? CountryCode { get; private set; }
    public FinanceCurrency Currency { get; private set; }
    public int FiscalYearStartMonth { get; private set; } = 1;

    // Organization details (for invoices, letters, etc.)
    public string OrganizationName { get; private set; } = string.Empty;
    public string OrganizationAddress { get; private set; } = string.Empty;
    public string OrganizationCity { get; private set; } = string.Empty;
    public string OrganizationPostalCode { get; private set; } = string.Empty;
    public string OrganizationCountry { get; private set; } = string.Empty;
    public string? OrganizationEmail { get; private set; }
    public string? OrganizationPhone { get; private set; }
    public string? OrganizationWebsite { get; private set; }
    public string? OrganizationUid { get; private set; }

    // REQ-062: VAT registration
    public VatStatus VatStatus { get; private set; } = VatStatus.NotRegistered;
    public string? VatNumber { get; private set; }

    // Bank details
    public string? BankName { get; private set; }
    public string? BankIban { get; private set; }
    public string? BankBic { get; private set; }

    // REQ-067: Payment approval thresholds
    public decimal? ApprovalThresholdChf { get; private set; }
    public decimal? ApprovalThresholdEur { get; private set; }

    public bool IsActive { get; private set; } = true;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    private FinanceProfile() { }

    public static FinanceProfile Create(
        Jurisdiction jurisdiction,
        string? countryCode,
        FinanceCurrency currency,
        int fiscalYearStartMonth,
        string organizationName,
        string organizationAddress,
        string organizationCity,
        string organizationPostalCode,
        string organizationCountry,
        string? organizationEmail,
        string? organizationPhone,
        string? organizationWebsite,
        string? organizationUid,
        string? bankName,
        string? bankIban,
        string? bankBic,
        VatStatus vatStatus = VatStatus.NotRegistered,
        string? vatNumber = null,
        decimal? approvalThresholdChf = null,
        decimal? approvalThresholdEur = null)
    {
        if (string.IsNullOrWhiteSpace(organizationName))
            throw new ArgumentException("Organization name is required.", nameof(organizationName));
        if (string.IsNullOrWhiteSpace(organizationAddress))
            throw new ArgumentException("Organization address is required.", nameof(organizationAddress));
        if (string.IsNullOrWhiteSpace(organizationCity))
            throw new ArgumentException("Organization city is required.", nameof(organizationCity));
        if (string.IsNullOrWhiteSpace(organizationPostalCode))
            throw new ArgumentException("Organization postal code is required.", nameof(organizationPostalCode));
        if (string.IsNullOrWhiteSpace(organizationCountry))
            throw new ArgumentException("Organization country is required.", nameof(organizationCountry));
        if (fiscalYearStartMonth is < 1 or > 12)
            throw new ArgumentOutOfRangeException(nameof(fiscalYearStartMonth), "Fiscal year start month must be between 1 and 12.");

        var now = DateTimeOffset.UtcNow;

        return new FinanceProfile
        {
            Jurisdiction = jurisdiction,
            CountryCode = countryCode?.Trim().ToUpperInvariant(),
            Currency = currency,
            FiscalYearStartMonth = fiscalYearStartMonth,
            OrganizationName = organizationName.Trim(),
            OrganizationAddress = organizationAddress.Trim(),
            OrganizationCity = organizationCity.Trim(),
            OrganizationPostalCode = organizationPostalCode.Trim(),
            OrganizationCountry = organizationCountry.Trim().ToUpperInvariant(),
            OrganizationEmail = organizationEmail?.Trim(),
            OrganizationPhone = organizationPhone?.Trim(),
            OrganizationWebsite = organizationWebsite?.Trim(),
            OrganizationUid = organizationUid?.Trim(),
            BankName = bankName?.Trim(),
            BankIban = bankIban?.Trim(),
            BankBic = bankBic?.Trim(),
            VatStatus = vatStatus,
            VatNumber = vatNumber?.Trim(),
            ApprovalThresholdChf = approvalThresholdChf,
            ApprovalThresholdEur = approvalThresholdEur,
            IsActive = true,
            CreatedAt = now,
            UpdatedAt = now
        };
    }

    public void Update(
        Jurisdiction jurisdiction,
        string? countryCode,
        FinanceCurrency currency,
        int fiscalYearStartMonth,
        string organizationName,
        string organizationAddress,
        string organizationCity,
        string organizationPostalCode,
        string organizationCountry,
        string? organizationEmail,
        string? organizationPhone,
        string? organizationWebsite,
        string? organizationUid,
        string? bankName,
        string? bankIban,
        string? bankBic,
        VatStatus vatStatus = VatStatus.NotRegistered,
        string? vatNumber = null,
        decimal? approvalThresholdChf = null,
        decimal? approvalThresholdEur = null)
    {
        if (string.IsNullOrWhiteSpace(organizationName))
            throw new ArgumentException("Organization name is required.", nameof(organizationName));
        if (string.IsNullOrWhiteSpace(organizationAddress))
            throw new ArgumentException("Organization address is required.", nameof(organizationAddress));
        if (string.IsNullOrWhiteSpace(organizationCity))
            throw new ArgumentException("Organization city is required.", nameof(organizationCity));
        if (string.IsNullOrWhiteSpace(organizationPostalCode))
            throw new ArgumentException("Organization postal code is required.", nameof(organizationPostalCode));
        if (string.IsNullOrWhiteSpace(organizationCountry))
            throw new ArgumentException("Organization country is required.", nameof(organizationCountry));
        if (fiscalYearStartMonth is < 1 or > 12)
            throw new ArgumentOutOfRangeException(nameof(fiscalYearStartMonth), "Fiscal year start month must be between 1 and 12.");

        Jurisdiction = jurisdiction;
        CountryCode = countryCode?.Trim().ToUpperInvariant();
        Currency = currency;
        FiscalYearStartMonth = fiscalYearStartMonth;
        OrganizationName = organizationName.Trim();
        OrganizationAddress = organizationAddress.Trim();
        OrganizationCity = organizationCity.Trim();
        OrganizationPostalCode = organizationPostalCode.Trim();
        OrganizationCountry = organizationCountry.Trim().ToUpperInvariant();
        OrganizationEmail = organizationEmail?.Trim();
        OrganizationPhone = organizationPhone?.Trim();
        OrganizationWebsite = organizationWebsite?.Trim();
        OrganizationUid = organizationUid?.Trim();
        BankName = bankName?.Trim();
        BankIban = bankIban?.Trim();
        BankBic = bankBic?.Trim();
        VatStatus = vatStatus;
        VatNumber = vatNumber?.Trim();
        ApprovalThresholdChf = approvalThresholdChf;
        ApprovalThresholdEur = approvalThresholdEur;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void Deactivate()
    {
        IsActive = false;
        UpdatedAt = DateTimeOffset.UtcNow;
    }
}
