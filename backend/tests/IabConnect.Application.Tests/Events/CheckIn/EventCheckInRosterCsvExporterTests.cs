using System.Text;
using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Infrastructure.Events;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023: Unit tests for <see cref="EventCheckInRosterCsvExporter"/>.
/// Covers adversarial CSV inputs (A8 retro): commas, quotes, CRLF, whitespace,
/// Umlauts. Asserts UTF-8 BOM, RFC-4180 quoting, and header order (AC-5).
/// </summary>
public sealed class EventCheckInRosterCsvExporterTests
{
    // Post-review D-S1-1: QrCodeToken column removed from the CSV (paper-roster credential
    // leak vector). The token remains on the in-app DTO for the authenticated scanner UI.
    private const string ExpectedHeader =
        "#,Name,Guests,Status,Waitlisted,CheckedIn,CheckedInAt,SpecialRequirements,[ ] (Anwesenheit)";

    [Fact]
    public void Export_StartsWithUtf8Bom()
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var bytes = exporter.Export(BuildRoster());

        bytes.Length.Should().BeGreaterThan(3);
        bytes[0].Should().Be(0xEF);
        bytes[1].Should().Be(0xBB);
        bytes[2].Should().Be(0xBF);
    }

    [Fact]
    public void Export_HeaderRowMatchesAcContract()
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var text = DecodeUtf8WithoutBom(exporter.Export(BuildRoster()));
        var lines = text.Split("\r\n", StringSplitOptions.None);

        lines[0].Should().Be(ExpectedHeader);
    }

    [Fact]
    public void Export_UsesCrlfLineEndings()
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var bytes = exporter.Export(BuildRoster(BuildItem("Anna")));
        var text = DecodeUtf8WithoutBom(bytes);

        text.Should().Contain("\r\n");
        text.Replace("\r\n", string.Empty, StringComparison.Ordinal)
            .Should().NotContain("\n");
    }

    [Theory]
    [InlineData("Müller, Hans")]                   // comma inside name
    [InlineData("\"Hans\"")]                        // double-quotes in name
    [InlineData("Hans\r\nMüller")]                  // CRLF inside name
    [InlineData("  Anna  ")]                        // leading/trailing whitespace
    [InlineData("Ärger,\"Über\" das \r\n Wetter")] // combined adversarial input
    public void Export_QuotesAndEscapesAdversarialNames(string name)
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var bytes = exporter.Export(BuildRoster(BuildItem(name)));
        var rows = ParseCsv(DecodeUtf8WithoutBom(bytes));

        rows.Should().HaveCountGreaterThan(1);
        rows[1][1].Should().Be(name); // round-trips through a minimal RFC-4180 parser
    }

    [Fact]
    public void Export_EmptySpecialRequirements_EmitsEmptyCell()
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var rows = ParseCsv(DecodeUtf8WithoutBom(
            exporter.Export(BuildRoster(BuildItem("Anna", specialRequirements: null)))));

        rows[1][7].Should().BeEmpty();
    }

    [Fact]
    public void Export_LongSpecialRequirements_RoundTrips()
    {
        var exporter = new EventCheckInRosterCsvExporter();
        var longText = new string('x', 50);

        var rows = ParseCsv(DecodeUtf8WithoutBom(
            exporter.Export(BuildRoster(BuildItem("Anna", specialRequirements: longText)))));

        rows[1][7].Should().Be(longText);
    }

    [Fact]
    public void Export_LastColumnIsEmptyAnwesenheitCell()
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var rows = ParseCsv(DecodeUtf8WithoutBom(
            exporter.Export(BuildRoster(BuildItem("Anna"), BuildItem("Berta")))));

        rows[1].Last().Should().BeEmpty();
        rows[2].Last().Should().BeEmpty();
    }

    [Fact]
    public void Export_RowIndexStartsAtOne()
    {
        var exporter = new EventCheckInRosterCsvExporter();

        var rows = ParseCsv(DecodeUtf8WithoutBom(
            exporter.Export(BuildRoster(BuildItem("Anna"), BuildItem("Berta")))));

        rows[1][0].Should().Be("1");
        rows[2][0].Should().Be("2");
    }

    [Fact]
    public void Export_DoesNotIncludeQrCodeToken()
    {
        // Post-review D-S1-1: paper rosters MUST NOT carry the QR token. The header has only
        // 9 columns and no per-row column contains the seed token.
        var exporter = new EventCheckInRosterCsvExporter();

        var bytes = exporter.Export(BuildRoster(BuildItem("Anna")));
        var text = DecodeUtf8WithoutBom(bytes);

        text.Should().NotContain("REG-ABCDEF0123456789");
        text.Should().NotContain("QrCodeToken");
        var rows = ParseCsv(text);
        rows[0].Should().HaveCount(9);
    }

    [Theory]
    [InlineData(DateTimeKind.Unspecified)]
    [InlineData(DateTimeKind.Utc)]
    [InlineData(DateTimeKind.Local)]
    public void Export_CheckedInAtFormatting_IsAlwaysUtcInIsoSuffixZ(DateTimeKind kind)
    {
        // Post-review H-S1-2: the persisted value is UTC; SpecifyKind relabels without shifting
        // (vs. ToUniversalTime which would shift by the server's local offset on Unspecified).
        var exporter = new EventCheckInRosterCsvExporter();
        var raw = new DateTime(2026, 5, 13, 18, 30, 0, kind);

        var rows = ParseCsv(DecodeUtf8WithoutBom(
            exporter.Export(BuildRoster(BuildItem("Anna", checkedInAt: raw)))));

        rows[1][6].Should().Be("2026-05-13T18:30:00Z");
    }

    [Fact]
    public void Export_LeadingTrailingWhitespace_IsQuoted()
    {
        // Post-review M-S1-2: Excel auto-trims leading/trailing whitespace from unquoted cells;
        // quoting preserves the original value byte-for-byte.
        var exporter = new EventCheckInRosterCsvExporter();
        var bytes = exporter.Export(BuildRoster(BuildItem("  Spaced  ")));
        var text = DecodeUtf8WithoutBom(bytes);
        // The second row's second column must contain the literal quoted form.
        text.Should().Contain("\"  Spaced  \"");
    }

    [Fact]
    public void Export_TabInValue_IsQuoted()
    {
        // Post-review M-S1-2: tabs are stripped by some CSV consumers if not quoted.
        var exporter = new EventCheckInRosterCsvExporter();
        var bytes = exporter.Export(BuildRoster(BuildItem("Foo\tBar")));
        var rows = ParseCsv(DecodeUtf8WithoutBom(bytes));
        rows[1][1].Should().Be("Foo\tBar");
    }

    // ----- test helpers -----

    private static string DecodeUtf8WithoutBom(byte[] bytes)
    {
        var utf8 = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
        var start = bytes.Length >= 3 && bytes[0] == 0xEF && bytes[1] == 0xBB && bytes[2] == 0xBF ? 3 : 0;
        return utf8.GetString(bytes, start, bytes.Length - start);
    }

    private static EventCheckInRosterDto BuildRoster(params EventCheckInRosterItemDto[] items)
    {
        return new EventCheckInRosterDto
        {
            EventId = Guid.NewGuid(),
            EventTitle = "Test",
            EventStartDate = new DateTime(2026, 5, 13, 18, 0, 0, DateTimeKind.Utc),
            EventLocation = "Bern",
            GeneratedAt = DateTime.UtcNow,
            TotalRegistrations = items.Length,
            CheckedInCount = items.Count(i => i.IsCheckedIn),
            Items = items
        };
    }

    private static EventCheckInRosterItemDto BuildItem(
        string name,
        string? specialRequirements = "",
        bool isCheckedIn = false,
        DateTime? checkedInAt = null)
    {
        return new EventCheckInRosterItemDto
        {
            RegistrationId = Guid.NewGuid(),
            QrCodeToken = "REG-ABCDEF0123456789",
            ParticipantName = name,
            NumberOfGuests = 1,
            Status = "Confirmed",
            IsWaitlisted = false,
            IsCheckedIn = isCheckedIn,
            CheckedInAt = checkedInAt,
            SpecialRequirements = specialRequirements
        };
    }

    /// <summary>
    /// Minimal RFC-4180 CSV parser used only by these tests. Handles quoted
    /// fields with embedded comma, embedded double-quote (escaped as ""),
    /// and embedded CRLF.
    /// </summary>
    private static List<List<string>> ParseCsv(string text)
    {
        var rows = new List<List<string>>();
        var currentRow = new List<string>();
        var currentField = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var ch = text[i];

            if (inQuotes)
            {
                if (ch == '"')
                {
                    if (i + 1 < text.Length && text[i + 1] == '"')
                    {
                        currentField.Append('"');
                        i++;
                    }
                    else
                    {
                        inQuotes = false;
                    }
                }
                else
                {
                    currentField.Append(ch);
                }
            }
            else
            {
                if (ch == '"')
                {
                    inQuotes = true;
                }
                else if (ch == ',')
                {
                    currentRow.Add(currentField.ToString());
                    currentField.Clear();
                }
                else if (ch == '\r')
                {
                    if (i + 1 < text.Length && text[i + 1] == '\n')
                    {
                        currentRow.Add(currentField.ToString());
                        currentField.Clear();
                        rows.Add(currentRow);
                        currentRow = new List<string>();
                        i++;
                    }
                }
                else if (ch == '\n')
                {
                    currentRow.Add(currentField.ToString());
                    currentField.Clear();
                    rows.Add(currentRow);
                    currentRow = new List<string>();
                }
                else
                {
                    currentField.Append(ch);
                }
            }
        }

        if (currentField.Length > 0 || currentRow.Count > 0)
        {
            currentRow.Add(currentField.ToString());
            rows.Add(currentRow);
        }

        return rows;
    }
}
