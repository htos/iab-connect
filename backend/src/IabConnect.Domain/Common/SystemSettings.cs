using IabConnect.Domain.Common;

namespace IabConnect.Domain.Common;

/// <summary>
/// System settings entity for configurable application properties (REQ-059)
/// Singleton entity — only one row exists in the database.
/// </summary>
public class SystemSettings : Entity
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
    /// Create default system settings
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
}
