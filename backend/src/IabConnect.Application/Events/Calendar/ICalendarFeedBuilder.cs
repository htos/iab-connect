using IabConnect.Domain.Events;

namespace IabConnect.Application.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5): Hand-rolled RFC 5545 ICS emitter. No third-party calendar library
/// dependency (per architecture.md REQ-025 guidance). The implementation handles:
/// VCALENDAR envelope + VEVENT blocks, CRLF line terminators, 75-octet folding,
/// RFC 5545 §3.3.11 text escaping, UTC ZULU formatting, and all-day DATE-VALUE handling.
/// </summary>
public interface ICalendarFeedBuilder
{
    /// <summary>
    /// Builds a complete VCALENDAR string for the supplied events. <paramref name="baseUrl"/>
    /// is the publicly-reachable site origin used to construct per-event <c>URL</c> properties
    /// (e.g. <c>"https://iab-connect.example"</c>). Returns UTF-8-safe text; the caller wraps
    /// in <c>Encoding.UTF8.GetBytes</c> when serving the body.
    /// </summary>
    string Build(IEnumerable<Event> events, string baseUrl);

    /// <summary>
    /// Same as <see cref="Build"/> but emits exactly one VEVENT. Used by the per-event
    /// <c>/{id}/calendar.ics</c> download path. The single-event UID matches the bulk-feed
    /// UID so calendar clients de-duplicate.
    /// </summary>
    string BuildSingle(Event evt, string baseUrl);
}
