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
            AppendLineFolded(sb, $"DTEND;VALUE=DATE:{FormatDateOnly(evt.EndDate)}");
        }
        else
        {
            AppendLineFolded(sb, $"DTSTART:{FormatUtc(evt.StartDate)}");
            AppendLineFolded(sb, $"DTEND:{FormatUtc(evt.EndDate)}");
        }

        AppendLineFolded(sb, $"SUMMARY:{EscapeIcsText(evt.Title)}");

        if (!string.IsNullOrWhiteSpace(evt.Description))
        {
            var truncated = evt.Description.Length > MaxDescriptionLength
                ? evt.Description[..MaxDescriptionLength]
                : evt.Description;
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

        // URL: only escape comma + semicolon per §3.3.11; backslash is URL-safe.
        var url = $"{baseUrl.TrimEnd('/')}/events/{evt.Id:D}";
        AppendLineFolded(sb, $"URL:{url.Replace(",", "\\,", StringComparison.Ordinal).Replace(";", "\\;", StringComparison.Ordinal)}");

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

            if (!isFirst) sb.Append(' ');
            sb.Append(Encoding.UTF8.GetString(bytes, pos, end - pos));
            sb.Append(LineBreak);
            pos = end;
            isFirst = false;
        }
    }
}
