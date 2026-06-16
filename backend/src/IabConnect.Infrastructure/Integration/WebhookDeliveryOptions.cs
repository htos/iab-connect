namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S4): delivery tuning, bound from the <c>Webhooks</c> configuration section. Defaults
/// are production-sane and require no configuration.
/// </summary>
public sealed class WebhookDeliveryOptions
{
    public const string SectionName = "Webhooks";

    /// <summary>Consecutive-failure count that auto-pauses a subscription (AC-4 / DEC-3). Default 15.</summary>
    public int PauseThreshold { get; set; } = 15;

    /// <summary>Outbound HTTP timeout (seconds) — short so a slow receiver never ties up a Hangfire worker.</summary>
    public int HttpTimeoutSeconds { get; set; } = 10;
}
