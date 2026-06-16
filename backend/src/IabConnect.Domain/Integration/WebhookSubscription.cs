using IabConnect.Domain.Common;

namespace IabConnect.Domain.Integration;

/// <summary>REQ-058 (E8-S3/S4): lifecycle state of a webhook subscription.</summary>
public enum WebhookSubscriptionStatus
{
    Active,

    /// <summary>REQ-058 (E8-S4): auto-paused after repeated delivery failures (reversible — admin re-enables).</summary>
    Paused,

    Disabled
}

/// <summary>
/// REQ-058 (E8-S3): an admin-configured webhook subscription — a target URL that receives signed
/// notifications for a whitelisted set of <see cref="WebhookEventTypes"/>.
///
/// <para><b>Secret storage (DEC-2 = B):</b> the entity stores <see cref="SecretCipher"/> — the
/// signing secret encrypted at rest (AES-256-GCM). Unlike an API key, the server must READ the
/// secret to compute the outbound HMAC signature on every delivery (E8-S4), so a one-way hash is
/// infeasible; reversible-at-rest is required. The cleartext is shown to the operator exactly once
/// at create/rotate so they can configure their receiver's verification.</para>
///
/// <para>Failure-tracking fields (consecutive failures, auto-disable) are owned by E8-S4.</para>
/// </summary>
public sealed class WebhookSubscription : Entity
{
    private readonly List<string> _eventTypes = [];

    public string Name { get; private set; } = string.Empty;
    public string TargetUrl { get; private set; } = string.Empty;

    /// <summary>Subscribed event types — a subset of <see cref="WebhookEventTypes.All"/>.</summary>
    public IReadOnlyCollection<string> EventTypes => _eventTypes.AsReadOnly();

    /// <summary>The signing secret, encrypted at rest. Never the cleartext.</summary>
    public string SecretCipher { get; private set; } = string.Empty;

    public WebhookSubscriptionStatus Status { get; private set; } = WebhookSubscriptionStatus.Active;

    /// <summary>REQ-058 (E8-S4): running count of consecutive delivery failures; resets to 0 on success.</summary>
    public int ConsecutiveFailureCount { get; private set; }

    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    private WebhookSubscription() { } // EF Core

    public static WebhookSubscription Create(
        string name,
        string targetUrl,
        IEnumerable<string> eventTypes,
        string secretCipher)
    {
        ValidateName(name);
        ValidateUrl(targetUrl);
        var typeList = ValidateEventTypes(eventTypes);
        if (string.IsNullOrWhiteSpace(secretCipher))
            throw new ArgumentException("Secret cipher is required", nameof(secretCipher));

        var sub = new WebhookSubscription
        {
            Name = name.Trim(),
            TargetUrl = targetUrl.Trim(),
            SecretCipher = secretCipher,
            Status = WebhookSubscriptionStatus.Active,
            CreatedAt = DateTime.UtcNow
        };
        sub._eventTypes.AddRange(typeList);
        return sub;
    }

    /// <summary>Edit the target URL and subscribed event types (the secret is rotated separately).</summary>
    public void UpdateConfiguration(string name, string targetUrl, IEnumerable<string> eventTypes)
    {
        ValidateName(name);
        ValidateUrl(targetUrl);
        var typeList = ValidateEventTypes(eventTypes);

        Name = name.Trim();
        TargetUrl = targetUrl.Trim();
        _eventTypes.Clear();
        _eventTypes.AddRange(typeList);
        UpdatedAt = DateTime.UtcNow;
    }

    public void Disable()
    {
        Status = WebhookSubscriptionStatus.Disabled;
        UpdatedAt = DateTime.UtcNow;
    }

    public void Enable()
    {
        Status = WebhookSubscriptionStatus.Active;
        ConsecutiveFailureCount = 0; // re-enabling clears the failure streak
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// REQ-058 (E8-S4, AC-4): records a delivery failure. Auto-pauses (reversible — A68 degrade-to-less)
    /// once the consecutive-failure streak reaches <paramref name="pauseThreshold"/>. No-op once Disabled.
    /// </summary>
    public void RecordFailure(int pauseThreshold)
    {
        if (Status == WebhookSubscriptionStatus.Disabled) return;
        ConsecutiveFailureCount++;
        if (ConsecutiveFailureCount >= pauseThreshold && Status == WebhookSubscriptionStatus.Active)
        {
            Status = WebhookSubscriptionStatus.Paused;
        }
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>REQ-058 (E8-S4, AC-4): a successful delivery resets the failure streak.</summary>
    public void RecordSuccess()
    {
        if (ConsecutiveFailureCount != 0)
        {
            ConsecutiveFailureCount = 0;
            UpdatedAt = DateTime.UtcNow;
        }
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("Webhook name is required", nameof(name));
    }

    /// <summary>Target must be an absolute HTTPS URL (defence-in-depth; full SSRF guard is E8-S4).</summary>
    private static void ValidateUrl(string targetUrl)
    {
        if (string.IsNullOrWhiteSpace(targetUrl)
            || !Uri.TryCreate(targetUrl, UriKind.Absolute, out var uri)
            || uri.Scheme != Uri.UriSchemeHttps)
        {
            throw new ArgumentException("Target URL must be an absolute https:// URL", nameof(targetUrl));
        }
    }

    private static List<string> ValidateEventTypes(IEnumerable<string> eventTypes)
    {
        var list = (eventTypes ?? []).Distinct().ToList();
        if (list.Count == 0)
            throw new ArgumentException("At least one event type must be subscribed", nameof(eventTypes));
        var unknown = list.Where(t => !WebhookEventTypes.All.Contains(t)).ToList();
        if (unknown.Count > 0)
            throw new ArgumentException(
                $"Unknown webhook event type(s): {string.Join(", ", unknown)}. Valid: {string.Join(", ", WebhookEventTypes.All)}",
                nameof(eventTypes));
        return list;
    }
}
