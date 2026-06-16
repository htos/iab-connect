namespace IabConnect.Domain.Integration;

/// <summary>
/// REQ-058 (E8-S3): the closed whitelist of event types a <see cref="WebhookSubscription"/> may
/// subscribe to. Webhooks are NOT a generic firehose of internal domain events — each supported
/// type is a deliberately hand-wired write-path trigger (there is no domain-event bus). Adding a
/// type means a new const here AND a new write-path emit call.
///
/// <para>Mirrors <see cref="IabConnect.Domain.Common.ModuleKeys"/> — a single source of truth.</para>
/// </summary>
public static class WebhookEventTypes
{
    /// <summary>A new event was created (triggered from the event create write path).</summary>
    public const string EventCreated = "event.created";

    /// <summary>A payment was marked received/paid (triggered from the finance write path).</summary>
    public const string PaymentReceived = "payment.received";

    /// <summary>All supported event types, in canonical order.</summary>
    public static readonly IReadOnlyList<string> All =
    [
        EventCreated,
        PaymentReceived,
    ];

    public static bool AreAllKnown(IEnumerable<string> eventTypes) => eventTypes.All(All.Contains);
}
