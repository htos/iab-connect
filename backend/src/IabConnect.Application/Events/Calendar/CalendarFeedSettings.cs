namespace IabConnect.Application.Events.Calendar;

/// <summary>
/// REQ-086 (E9-S3): startup-bound configuration for the ICS calendar feed. Singleton-safe
/// (the <see cref="CalendarFeedBuilder"/> is a singleton, so this cannot read the Scoped
/// <c>SystemSettings</c>). The <see cref="ProdId"/> default exactly preserves the previous
/// hardcoded <c>const</c> value so an unconfigured deployment emits byte-identical feeds.
/// </summary>
public sealed class CalendarFeedSettings
{
    public const string SectionName = "CalendarFeed";

    /// <summary>
    /// RFC 5545 <c>PRODID</c> property value. Default preserves the pre-REQ-086 literal.
    /// <c>init</c>-only so the singleton-registered bound instance cannot be mutated at runtime.
    /// </summary>
    public string ProdId { get; init; } = "-//IAB Connect//Events//EN";
}
