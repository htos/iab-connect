namespace IabConnect.Domain.Privacy;

/// <summary>
/// Represents a user's consent for a specific purpose (REQ-012: DSGVO)
/// </summary>
public class Consent
{
    public Guid Id { get; private set; }

    /// <summary>
    /// The user (Keycloak ID) who gave/revoked consent
    /// </summary>
    public Guid UserId { get; private set; }

    /// <summary>
    /// The type of consent
    /// </summary>
    public ConsentType Type { get; private set; }

    /// <summary>
    /// Whether consent is currently granted
    /// </summary>
    public bool IsGranted { get; private set; }

    /// <summary>
    /// When consent was first granted
    /// </summary>
    public DateTime GrantedAt { get; private set; }

    /// <summary>
    /// When consent was revoked (null if still active)
    /// </summary>
    public DateTime? RevokedAt { get; private set; }

    /// <summary>
    /// Version of the privacy policy/terms at time of consent
    /// </summary>
    public string PolicyVersion { get; private set; } = string.Empty;

    /// <summary>
    /// IP address at time of consent (for audit purposes)
    /// </summary>
    public string? IpAddress { get; private set; }

    /// <summary>
    /// User agent at time of consent (for audit purposes)
    /// </summary>
    public string? UserAgent { get; private set; }

    /// <summary>
    /// Last modification timestamp
    /// </summary>
    public DateTime UpdatedAt { get; private set; }

    private Consent() { } // EF Core

    public static Consent Grant(
        Guid userId,
        ConsentType type,
        string policyVersion,
        string? ipAddress = null,
        string? userAgent = null)
    {
        return new Consent
        {
            Id = Guid.NewGuid(),
            UserId = userId,
            Type = type,
            IsGranted = true,
            GrantedAt = DateTime.UtcNow,
            PolicyVersion = policyVersion,
            IpAddress = ipAddress,
            UserAgent = userAgent,
            UpdatedAt = DateTime.UtcNow
        };
    }

    public void Revoke()
    {
        if (!IsGranted)
            return;

        IsGranted = false;
        RevokedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ReGrant(string policyVersion, string? ipAddress = null, string? userAgent = null)
    {
        IsGranted = true;
        GrantedAt = DateTime.UtcNow;
        RevokedAt = null;
        PolicyVersion = policyVersion;
        IpAddress = ipAddress;
        UserAgent = userAgent;
        UpdatedAt = DateTime.UtcNow;
    }
}
