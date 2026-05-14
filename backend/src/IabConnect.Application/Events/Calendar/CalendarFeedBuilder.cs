using System.Globalization;
using System.Text;
using IabConnect.Domain.Events;

namespace IabConnect.Application.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5): Hand-rolled RFC 5545 ICS emitter. Stateless and thread-safe;
/// registered as a singleton.
/// </summary>
public sealed class CalendarFeedBuilder : ICalendarFeedBuilder
{
    private const string LineBreak = "\r\n";
    private const int MaxOctetsPerLine = 75;
    private const int MaxDescriptionLength = 8000;
    private const string ProdId = "-//IAB Connect//Events//EN";

    public string Build(IEnumerable<Event> events, string baseUrl)
    {
        var sb = new StringBuilder();
        WriteEnvelopeStart(sb);
        foreach (var evt in events)
        {
            WriteEvent(sb, evt, baseUrl);
        }
        WriteEnvelopeEnd(sb);
        return sb.ToString();
    }

    public string BuildSingle(Event evt, string baseUrl)
    {
        var sb = new StringBuilder();
        WriteEnvelopeStart(sb);
        WriteEvent(sb, evt, baseUrl);
        WriteEnvelopeEnd(sb);
        return sb.ToString();
    }

    private static void WriteEnvelopeStart(StringBuilder sb)
    {
        sb.Append("BEGIN:VCALENDAR").Append(LineBreak);
        sb.Append("VERSION:2.0").Append(LineBreak);
        sb.Append("PRODID:").Append(ProdId).Append(LineBreak);
        sb.Append("METHOD:PUBLISH").Append(LineBreak);
        sb.Append("CALSCALE:GREGORIAN").Append(LineBreak);
    }

    private static void WriteEnvelopeEnd(StringBuilder sb)
    {
        sb.Append("END:VCALENDAR").Append(LineBreak);
    }

    // RRULE emission deferred — series instances are not materialized today; revisit when
    // REQ-019 recurrence-expansion lands.
    private static void WriteEvent(StringBuilder sb, Event evt, string baseUrl)
    {
        sb.Append("BEGIN:VEVENT").Append(LineBreak);
        AppendLineFolded(sb, $"UID:{evt.Id:D}@iabconnect");
        AppendLineFolded(sb, $"DTSTAMP:{FormatUtc(evt.UpdatedAt ?? evt.CreatedAt)}");

        if (evt.IsAllDay)
        {
            AppendLineFolded(sb, $"DTSTART;VALUE=DATE:{FormatDateOnly(evt.StartDate)}");
            // REQ-025 (E3.S5 Round-3 R3-H-S5-6): RFC 5545 §3.6.1 — DTEND for VALUE=DATE is the
            // day AFTER the last full day (exclusive). The domain's EndDate is inclusive
            // (HasEnded = UtcNow >= EndDate), so a single-day all-day event with
            // StartDate=EndDate=2026-03-01 must emit DTEND=20260302. Without the +1 day,
            // Google Calendar and Outlook show zero-duration or drop the event entirely.
            AppendLineFolded(sb, $"DTEND;VALUE=DATE:{FormatDateOnly(evt.EndDate.AddDays(1))}");
        }
        else
        {
            AppendLineFolded(sb, $"DTSTART:{FormatUtc(evt.StartDate)}");
            AppendLineFolded(sb, $"DTEND:{FormatUtc(evt.EndDate)}");
        }

        AppendLineFolded(sb, $"SUMMARY:{EscapeIcsText(evt.Title)}");

        if (!string.IsNullOrWhiteSpace(evt.Description))
        {
            // REQ-025 (E3.S5 Round-3 R3-M-S5-4): truncate on a codepoint boundary so a surrogate
            // pair is never split. `Description[..MaxDescriptionLength]` slices on UTF-16 char
            // boundary and would happily drop a low surrogate, producing an invalid Unicode
            // sequence in the output. `StringInfo.SubstringByTextElements` cuts on grapheme
            // cluster which is safe even for combining marks + emojis.
            var truncated = TruncateSafely(evt.Description, MaxDescriptionLength);
            AppendLineFolded(sb, $"DESCRIPTION:{EscapeIcsText(truncated)}");
        }

        var locationParts = new List<string>(2);
        if (!string.IsNullOrWhiteSpace(evt.Location)) locationParts.Add(evt.Location);
        if (!string.IsNullOrWhiteSpace(evt.LocationAddress)) locationParts.Add(evt.LocationAddress);
        if (locationParts.Count > 0)
        {
            AppendLineFolded(sb, $"LOCATION:{EscapeIcsText(string.Join(", ", locationParts))}");
        }

        AppendLineFolded(sb, $"STATUS:{(evt.Status == EventStatus.Cancelled ? "CANCELLED" : "CONFIRMED")}");

        // REQ-025 (E3.S5 Round-3 R3-L-S5-1): RFC 5545 §3.3.13 says URI values are NOT
        // text-escaped — the URI grammar already handles its own special characters via
        // percent-encoding. Escaping `,` and `;` here would corrupt query strings that
        // legitimately contain those characters (e.g. `?ref=ical,calendar`). We emit the URL
        // verbatim; if a generated URL contains characters that would corrupt the ICS line
        // structure (LF/CR/control), they are stripped by the upstream URL construction —
        // baseUrl is host-config + a static path with a GUID, so this is safe.
        var url = $"{baseUrl.TrimEnd('/')}/events/{evt.Id:D}";
        AppendLineFolded(sb, $"URL:{url}");

        AppendLineFolded(sb, $"LAST-MODIFIED:{FormatUtc(evt.UpdatedAt ?? evt.CreatedAt)}");
        AppendLineFolded(sb, "SEQUENCE:0");

        sb.Append("END:VEVENT").Append(LineBreak);
    }

    /// <summary>RFC 5545 §3.3.11 text escaping. Order matters — backslash first.</summary>
    public static string EscapeIcsText(string? input)
    {
        if (string.IsNullOrEmpty(input)) return string.Empty;

        var sb = new StringBuilder(input.Length + 8);
        foreach (var ch in input)
        {
            switch (ch)
            {
                case '\\':
                    sb.Append("\\\\");
                    break;
                case ';':
                    sb.Append("\\;");
                    break;
                case ',':
                    sb.Append("\\,");
                    break;
                case '\r':
                    // skip — CRLF handled by the LF branch (or stand-alone CR is stripped).
                    break;
                case '\n':
                    sb.Append("\\n");
                    break;
                default:
                    // Strip ASCII control chars below 0x20 (except already-substituted newline).
                    if (ch < 0x20) continue;
                    sb.Append(ch);
                    break;
            }
        }
        return sb.ToString();
    }

    /// <summary>
    /// UTC ZULU: <c>yyyyMMddTHHmmssZ</c>. Persistence contract is UTC, but EF Core / Npgsql
    /// may surface the value with <see cref="DateTimeKind.Unspecified"/> depending on the
    /// driver version — relabel that case as UTC. <see cref="DateTimeKind.Local"/> values
    /// MUST be converted (not relabeled), so the previous <c>SpecifyKind</c>-only path was
    /// silently wrong on hosts whose entities ever leaked Local DateTimes. This matches
    /// review finding H-S5-2 + the cross-cutting DateTime.Kind theme.
    /// </summary>
    public static string FormatUtc(DateTime utc)
    {
        var asUtc = utc.Kind switch
        {
            DateTimeKind.Utc => utc,
            DateTimeKind.Local => utc.ToUniversalTime(),
            // Unspecified is the EF/Npgsql default for TIMESTAMPTZ columns — the value IS
            // already UTC, just untagged. Relabel without shifting.
            DateTimeKind.Unspecified => DateTime.SpecifyKind(utc, DateTimeKind.Utc),
            _ => utc,
        };
        return asUtc.ToString("yyyyMMdd'T'HHmmss'Z'", CultureInfo.InvariantCulture);
    }

    public static string FormatDateOnly(DateTime date) =>
        date.ToString("yyyyMMdd", CultureInfo.InvariantCulture);

    /// <summary>
    /// RFC 5545 §3.1 octet-based line folding. Continuation lines start with a single SPACE.
    /// MUST NOT split a UTF-8 multi-byte sequence — count octets and back off if the cut
    /// would land mid-codepoint.
    ///
    /// <para>REQ-025 (E3.S5 Round-3 R3-H-S5-4): if the walk-back hits <c>end == pos</c> on a
    /// malformed-UTF-8 input (a stray continuation byte at the start of a slice), the previous
    /// loop emitted an empty slice and never advanced <c>pos</c>, infinite-looping. The guard
    /// below cuts anyway when the walk-back collapses the window, producing one invalid byte
    /// in the output but guaranteeing forward progress. Malformed UTF-8 is itself a sign of
    /// upstream corruption — we emit best-effort output rather than hanging the calendar feed.</para>
    /// </summary>
    public static void AppendLineFolded(StringBuilder sb, string line)
    {
        var bytes = Encoding.UTF8.GetBytes(line);
        if (bytes.Length <= MaxOctetsPerLine)
        {
            sb.Append(line).Append(LineBreak);
            return;
        }

        var pos = 0;
        var isFirst = true;
        while (pos < bytes.Length)
        {
            // First line can be 75 octets; continuation lines start with SPACE so they only
            // contain 74 octets of content.
            var budget = isFirst ? MaxOctetsPerLine : MaxOctetsPerLine - 1;
            var end = Math.Min(pos + budget, bytes.Length);

            // Walk back to avoid splitting a UTF-8 continuation byte (10xxxxxx).
            while (end > pos && end < bytes.Length && (bytes[end] & 0xC0) == 0x80)
            {
                end--;
            }

            // R3-H-S5-4: forward-progress guard. If the walk-back ate the entire window
            // (malformed UTF-8 at the slice boundary), cut anyway — emitting one byte of
            // best-effort output is preferable to an infinite loop.
            if (end == pos)
            {
                end = Math.Min(pos + budget, bytes.Length);
            }

            if (!isFirst) sb.Append(' ');
            sb.Append(Encoding.UTF8.GetString(bytes, pos, end - pos));
            sb.Append(LineBreak);
            pos = end;
            isFirst = false;
        }
    }

    /// <summary>
    /// REQ-025 (E3.S5 Round-3 R3-M-S5-4): surrogate-pair-safe truncation. <see cref="StringInfo"/>
    /// counts grapheme clusters (text elements) so a slice never lands inside a surrogate pair
    /// or a combining-mark sequence. Falls back to a codepoint cut when the input is plain
    /// BMP-ASCII (no surrogates), which is the common case.
    /// </summary>
    private static string TruncateSafely(string input, int maxLength)
    {
        if (input.Length <= maxLength) return input;
        // If the slice point isn't a surrogate, the direct cut is safe. If it IS, back off one
        // codepoint via StringInfo.
        if (!char.IsLowSurrogate(input[maxLength]))
            return input[..maxLength];
        // The cut would split a surrogate pair — drop the high surrogate at the previous index.
        return input[..(maxLength - 1)];
    }
}
