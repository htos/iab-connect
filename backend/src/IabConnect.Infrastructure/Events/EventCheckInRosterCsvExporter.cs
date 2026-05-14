using System.Globalization;
using System.Text;
using IabConnect.Application.Events.CheckIn;

namespace IabConnect.Infrastructure.Events;

/// <summary>
/// REQ-023: Hand-rolled RFC-4180 CSV writer for the check-in roster.
/// Emits UTF-8 with BOM (so Excel-Windows opens Umlauts correctly), CRLF
/// line endings, comma separator. The last column is an empty "Present"
/// cell so paper rosters have a tick-box that staff can hand-mark.
///
/// <para>REQ-023 (E3.S1 review D-S1-1): the QR token column was removed from the CSV.
/// Printed rosters are a credential-leak vector — anyone holding the paper can scan or
/// type the token at the QR endpoint to check in / out any attendee. The token remains
/// on the in-app DTO for the authenticated scanner UI; CSV downloads keep the lookup
/// keys (Name + RegistrationId-equivalent row) without exposing the credential.</para>
///
/// <para>REQ-023 (E3.S1 Round-3 R3-DN-6 + R3-L-S1-1): header column renamed from
/// "[ ] (Anwesenheit)" to "Present". Decision DN-6 selected option (b) — full English headers
/// — so the German "Anwesenheit" label was the last German artifact in an otherwise English
/// CSV. The "[ ]" literal was also dropped per L-S1-1 (some Excel locales mis-parse "[ ]" as
/// part of a name-range expression). The cell value below the header is still empty so paper
/// roster staff can tick it by hand.</para>
/// </summary>
public sealed class EventCheckInRosterCsvExporter : IEventCheckInRosterCsvExporter
{
    private static readonly string[] HeaderColumns =
    [
        "#",
        "Name",
        "Guests",
        "Status",
        "Waitlisted",
        "CheckedIn",
        "CheckedInAt",
        "SpecialRequirements",
        "Present"
    ];

    public byte[] Export(EventCheckInRosterDto roster)
    {
        ArgumentNullException.ThrowIfNull(roster);

        using var ms = new MemoryStream();
        var utf8WithBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: true);

        using (var sw = new StreamWriter(ms, utf8WithBom, leaveOpen: true) { NewLine = "\r\n" })
        {
            sw.WriteLine(BuildRow(HeaderColumns));

            for (var idx = 0; idx < roster.Items.Count; idx++)
            {
                var item = roster.Items[idx];
                var rowCells = new[]
                {
                    (idx + 1).ToString(CultureInfo.InvariantCulture),
                    // REQ-023 (E3.S1 review M-S1-3): the DTO marks fields `required` but EF/Mapper
                    // edge-cases could still produce a null at runtime. Coalesce defensively so a
                    // single bad row never NREs the whole export.
                    item.ParticipantName ?? string.Empty,
                    item.NumberOfGuests.ToString(CultureInfo.InvariantCulture),
                    item.Status ?? string.Empty,
                    item.IsWaitlisted ? "true" : "false",
                    item.IsCheckedIn ? "true" : "false",
                    FormatCheckedInAtUtc(item.CheckedInAt),
                    item.SpecialRequirements ?? string.Empty,
                    string.Empty
                };
                sw.WriteLine(BuildRow(rowCells));
            }
        }

        return ms.ToArray();
    }

    /// <summary>
    /// REQ-023 (E3.S1 review H-S1-2): the value is persisted as UTC, but EF may surface it with
    /// <see cref="DateTimeKind.Unspecified"/> depending on the EF provider configuration. Using
    /// <see cref="DateTime.ToUniversalTime"/> on an Unspecified value treats it as LOCAL and
    /// shifts by the server's local offset, silently shifting the CSV time. <see cref="DateTime.SpecifyKind"/>
    /// relabels without shifting — which is what we want, since the wire value is already UTC.
    /// </summary>
    private static string FormatCheckedInAtUtc(DateTime? checkedInAt)
    {
        if (!checkedInAt.HasValue)
            return string.Empty;
        var utc = checkedInAt.Value.Kind == DateTimeKind.Utc
            ? checkedInAt.Value
            : DateTime.SpecifyKind(checkedInAt.Value, DateTimeKind.Utc);
        return utc.ToString("yyyy-MM-ddTHH:mm:ssZ", CultureInfo.InvariantCulture);
    }

    private static string BuildRow(IReadOnlyList<string> cells)
    {
        var sb = new StringBuilder();
        for (var i = 0; i < cells.Count; i++)
        {
            if (i > 0)
                sb.Append(',');
            // R3-M-S1-1: force-quote the last cell when empty. Some Excel locales aggressively
            // strip a trailing empty cell after the final comma, collapsing the tick-box column
            // out of the row. A quoted empty cell ("") survives that pass.
            var isLast = i == cells.Count - 1;
            sb.Append(EscapeForCsvCell(cells[i], forceQuoteEmpty: isLast));
        }
        return sb.ToString();
    }

    /// <summary>
    /// REQ-023 (E3.S1 Round-3 R3-C1): defense against CSV/spreadsheet formula injection.
    /// OWASP recommends prefixing any cell whose first character is in <c>{=,+,-,@}</c> with a
    /// single quote — Excel/Sheets/LibreOffice treat the leading <c>'</c> as a literal-string
    /// indicator and skip formula evaluation. The cell is also force-quoted so the leading
    /// <c>'</c> survives parser round-trips. Critical: <see cref="EventCheckInRosterItemDto.ParticipantName"/>
    /// and <see cref="EventCheckInRosterItemDto.SpecialRequirements"/> are populated from the
    /// public registration form, so a hostile registrant can submit
    /// <c>=cmd|'/c calc'!A1</c> as their name and have it executed on staff workstations the
    /// moment the CSV is opened. The escape is applied to <em>every</em> string cell — the
    /// numeric / boolean / enum columns never start with these characters, so the broad rule
    /// is cheap and removes any future risk if a string column is added.
    /// </summary>
    private static string EscapeForCsvCell(string value, bool forceQuoteEmpty)
    {
        if (value.Length == 0)
            return forceQuoteEmpty ? "\"\"" : value;

        var first = value[0];
        if (first == '=' || first == '+' || first == '-' || first == '@')
        {
            var prefixed = "'" + value;
            var escapedPrefix = prefixed.Replace("\"", "\"\"", StringComparison.Ordinal);
            return $"\"{escapedPrefix}\"";
        }

        return QuoteIfNeeded(value);
    }

    /// <summary>
    /// REQ-023 (E3.S1 review M-S1-2): quote when the value contains any character that would
    /// confuse a CSV reader OR Excel's auto-trim. Excel strips leading/trailing whitespace AND
    /// tab characters from unquoted cells, so "  Alice  " loses its padding and "Foo\tBar"
    /// loses the tab. Quoting preserves the value byte-for-byte.
    /// </summary>
    private static string QuoteIfNeeded(string value)
    {
        if (value.Length == 0)
            return value;

        var needsQuotes = false;
        foreach (var ch in value)
        {
            if (ch == ',' || ch == '"' || ch == '\r' || ch == '\n' || ch == '\t')
            {
                needsQuotes = true;
                break;
            }
        }

        if (!needsQuotes && (char.IsWhiteSpace(value[0]) || char.IsWhiteSpace(value[^1])))
            needsQuotes = true;

        if (!needsQuotes)
            return value;

        var escaped = value.Replace("\"", "\"\"", StringComparison.Ordinal);
        return $"\"{escaped}\"";
    }
}
