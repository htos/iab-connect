using System.Text.RegularExpressions;

namespace IabConnect.Domain.Common;

/// <summary>
/// System settings entity for configurable application properties (REQ-059).
/// Singleton entity — only one row exists in the database.
/// REQ-086 (E9-S1): extended with organization-profile + branding fields so the
/// platform identity is admin-configurable and the deployment can be white-labelled
/// without code changes. All REQ-086 fields are nullable; a <c>NULL</c> value means
/// "not configured" and keeps the deployment's current behaviour-preserving defaults.
/// </summary>
public partial class SystemSettings : Entity
{
    /// <summary>
    /// Application display name (e.g., "IAB Connect")
    /// </summary>
    public string ApplicationName { get; private set; } = "IAB Connect";

    /// <summary>
    /// Short text displayed inside the logo circle (e.g., "IAB")
    /// </summary>
    public string LogoText { get; private set; } = "IAB";

    /// <summary>
    /// Background color of the logo circle (hex, e.g., "#EA580C")
    /// </summary>
    public string LogoBackgroundColor { get; private set; } = "#EA580C";

    /// <summary>
    /// Text color inside the logo circle (hex, e.g., "#FFFFFF")
    /// </summary>
    public string LogoTextColor { get; private set; } = "#FFFFFF";

    // --- REQ-086 (E9-S1) organization profile & branding ----------------------

    /// <summary>
    /// REQ-086: Free-text organization description shown on public-facing surfaces.
    /// <c>null</c> when not configured.
    /// </summary>
    public string? Description { get; private set; }

    /// <summary>
    /// REQ-086: Organization contact email. Admin-only — never exposed anonymously.
    /// <c>null</c> when not configured.
    /// </summary>
    public string? ContactEmail { get; private set; }

    /// <summary>
    /// REQ-086: Organization contact phone. Admin-only — never exposed anonymously.
    /// <c>null</c> when not configured.
    /// </summary>
    public string? ContactPhone { get; private set; }

    /// <summary>
    /// REQ-086: Organization postal/contact address. Admin-only — never exposed anonymously.
    /// <c>null</c> when not configured.
    /// </summary>
    public string? ContactAddress { get; private set; }

    /// <summary>
    /// REQ-086: Primary brand color (hex, e.g., "#EA580C"). <c>null</c> when not configured.
    /// </summary>
    public string? PrimaryColor { get; private set; }

    /// <summary>
    /// REQ-086: Whether the public website is served. <c>null</c> and <c>true</c> both
    /// mean "public site enabled" (behaviour-preserving default).
    /// </summary>
    public bool? PublicSiteEnabled { get; private set; }

    /// <summary>
    /// REQ-086: Storage key of the uploaded organization logo asset (under the
    /// <c>branding/</c> prefix). Set exclusively by <see cref="SetLogoAssetKey"/>.
    /// <c>null</c> when no logo has been uploaded.
    /// </summary>
    public string? LogoAssetKey { get; private set; }

    /// <summary>
    /// Timestamp of last update
    /// </summary>
    public DateTime UpdatedAt { get; private set; }

    /// <summary>
    /// User who last updated the settings
    /// </summary>
    public string? UpdatedBy { get; private set; }

    // EF Core constructor
    private SystemSettings() { }

    /// <summary>
    /// Create default system settings. REQ-086 fields default to <c>null</c>
    /// (not configured) — the deployment keeps its current presentation until an
    /// admin configures it.
    /// </summary>
    public static SystemSettings CreateDefault()
    {
        return new SystemSettings
        {
            UpdatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Update the application branding settings
    /// </summary>
    public void UpdateBranding(
        string applicationName,
        string logoText,
        string logoBackgroundColor,
        string logoTextColor,
        string? updatedBy = null)
    {
        if (string.IsNullOrWhiteSpace(applicationName))
            throw new ArgumentException("Application name cannot be empty.", nameof(applicationName));
        if (string.IsNullOrWhiteSpace(logoText))
            throw new ArgumentException("Logo text cannot be empty.", nameof(logoText));
        if (string.IsNullOrWhiteSpace(logoBackgroundColor))
            throw new ArgumentException("Logo background color cannot be empty.", nameof(logoBackgroundColor));
        if (string.IsNullOrWhiteSpace(logoTextColor))
            throw new ArgumentException("Logo text color cannot be empty.", nameof(logoTextColor));

        ApplicationName = applicationName.Trim();
        LogoText = logoText.Trim();
        LogoBackgroundColor = logoBackgroundColor.Trim();
        LogoTextColor = logoTextColor.Trim();
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// REQ-086: Update the organization profile / branding fields. Each value is
    /// optional — a non-blank value is trimmed and (where applicable) format-checked;
    /// a <c>null</c> or blank value clears the field. <see cref="LogoAssetKey"/> is
    /// intentionally NOT touched here — it is owned by <see cref="SetLogoAssetKey"/>.
    /// </summary>
    /// <exception cref="ArgumentException">
    /// Thrown when <paramref name="contactEmail"/> is non-blank but not a valid email
    /// shape, or <paramref name="primaryColor"/> is non-blank but not a valid hex color.
    /// </exception>
    public void UpdateOrganizationProfile(
        string? description,
        string? contactEmail,
        string? contactPhone,
        string? contactAddress,
        string? primaryColor,
        bool? publicSiteEnabled,
        string? updatedBy = null)
    {
        // Review hardening (REQ-086): normalize + validate everything BEFORE assigning any
        // field, so a format failure cannot leave the entity half-mutated.
        var normalizedDescription = NormalizeOptional(description);
        var normalizedPhone = NormalizeOptional(contactPhone);
        var normalizedAddress = NormalizeOptional(contactAddress);

        var email = NormalizeOptional(contactEmail);
        if (email is not null && !EmailRegex().IsMatch(email))
            throw new ArgumentException("Contact email is not a valid email address.", nameof(contactEmail));

        var color = NormalizeOptional(primaryColor);
        if (color is not null && !HexColorRegex().IsMatch(color))
            throw new ArgumentException("Primary color must be a hex color (e.g. #EA580C).", nameof(primaryColor));

        Description = normalizedDescription;
        ContactPhone = normalizedPhone;
        ContactAddress = normalizedAddress;
        ContactEmail = email;
        PrimaryColor = color;
        PublicSiteEnabled = publicSiteEnabled;

        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    /// <summary>
    /// REQ-086: Set (or clear) the uploaded logo asset storage key. Called exclusively
    /// by the logo upload endpoint after the asset has been persisted to storage.
    /// A <c>null</c> or blank key clears the logo.
    /// </summary>
    public void SetLogoAssetKey(string? key, string? updatedBy = null)
    {
        LogoAssetKey = NormalizeOptional(key);
        UpdatedAt = DateTime.UtcNow;
        UpdatedBy = updatedBy;
    }

    private static string? NormalizeOptional(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    [GeneratedRegex(@"^[^@\s]+@[^@\s]+\.[^@\s]+$")]
    private static partial Regex EmailRegex();

    [GeneratedRegex(@"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$")]
    private static partial Regex HexColorRegex();
}
