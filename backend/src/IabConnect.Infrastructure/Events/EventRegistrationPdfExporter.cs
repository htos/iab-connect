using IabConnect.Application.Events;
using IabConnect.Domain.Events;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace IabConnect.Infrastructure.Events;

public class EventRegistrationPdfExporter : IRegistrationPdfExporter
{
    private static readonly string PrimaryColor = "#EA580C"; // Orange-600
    private static readonly string HeaderBg = "#FFF7ED";
    private static readonly string BorderColor = "#E5E7EB";
    private static readonly string TextDark = "#111827";
    private static readonly string TextMuted = "#6B7280";

    public Task<byte[]> GenerateRegistrationListPdfAsync(
        Event evt,
        IReadOnlyList<EventRegistration> registrations,
        EventRegistrationStatistics statistics)
    {
        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4.Landscape());
                page.MarginTop(30);
                page.MarginBottom(25);
                page.MarginHorizontal(30);
                page.DefaultTextStyle(x => x.FontSize(9).FontColor(TextDark));

                page.Header().Element(h => ComposeHeader(h, evt, statistics));
                page.Content().Element(c => ComposeContent(c, registrations));
                page.Footer().Element(ComposeFooter);
            });
        });

        var pdfBytes = document.GeneratePdf();
        return Task.FromResult(pdfBytes);
    }

    private static void ComposeHeader(IContainer container, Event evt, EventRegistrationStatistics stats)
    {
        container.Column(column =>
        {
            // Title bar
            column.Item().Background(PrimaryColor).Padding(12).Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text("IAB Connect – Anmeldeliste")
                        .FontSize(16).Bold().FontColor(Colors.White);
                    col.Item().Text(evt.Title)
                        .FontSize(12).FontColor(Colors.White);
                });
                row.ConstantItem(200).AlignRight().Column(col =>
                {
                    col.Item().Text($"Datum: {evt.StartDate:dd.MM.yyyy HH:mm}")
                        .FontSize(9).FontColor(Colors.White);
                    if (!string.IsNullOrWhiteSpace(evt.Location))
                    {
                        col.Item().Text($"Ort: {evt.Location}")
                            .FontSize(9).FontColor(Colors.White);
                    }
                });
            });

            // Statistics row
            column.Item().PaddingVertical(8).Background(HeaderBg).PaddingHorizontal(12).Row(row =>
            {
                row.RelativeItem().Text($"Total: {stats.TotalRegistrations}")
                    .FontSize(9).Bold();
                row.RelativeItem().Text($"Bestätigt: {stats.ConfirmedCount}")
                    .FontSize(9).FontColor("#15803D");
                row.RelativeItem().Text($"Eingecheckt: {stats.CheckedInCount}")
                    .FontSize(9).FontColor("#059669");
                row.RelativeItem().Text($"Warteliste: {stats.WaitlistedCount}")
                    .FontSize(9).FontColor("#1D4ED8");
                row.RelativeItem().Text($"Storniert: {stats.CancelledCount}")
                    .FontSize(9).FontColor("#DC2626");
                row.RelativeItem().Text($"No-Show: {stats.NoShowCount}")
                    .FontSize(9).FontColor(TextMuted);
            });

            column.Item().PaddingBottom(6);
        });
    }

    private static void ComposeContent(IContainer container, IReadOnlyList<EventRegistration> registrations)
    {
        container.Table(table =>
        {
            table.ColumnsDefinition(columns =>
            {
                columns.ConstantColumn(30);   // #
                columns.RelativeColumn(3);     // Name
                columns.RelativeColumn(3);     // Email
                columns.RelativeColumn(2);     // Phone
                columns.ConstantColumn(50);    // Guests
                columns.RelativeColumn(1.5f);  // Status
                columns.RelativeColumn(2);     // Registered at
                columns.RelativeColumn(2);     // Notes
            });

            // Header row
            table.Header(header =>
            {
                var headerStyle = TextStyle.Default.FontSize(8).Bold().FontColor(TextMuted);

                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("#").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("Name").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("E-Mail").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("Telefon").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .AlignCenter().Text("Gäste").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("Status").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("Angemeldet am").Style(headerStyle);
                header.Cell().BorderBottom(1).BorderColor(BorderColor).PaddingVertical(6).PaddingHorizontal(4)
                    .Text("Bemerkungen").Style(headerStyle);
            });

            // Data rows
            var ordered = registrations
                .OrderBy(r => r.Status == RegistrationStatus.Cancelled ? 1 : 0)
                .ThenBy(r => r.ParticipantName)
                .ToList();

            for (int i = 0; i < ordered.Count; i++)
            {
                var reg = ordered[i];
                var bg = i % 2 == 0 ? Colors.White : (Color)"#F9FAFB";
                var rowStyle = TextStyle.Default.FontSize(8).FontColor(TextDark);

                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text($"{i + 1}").Style(rowStyle);
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text(reg.ParticipantName).Style(rowStyle);
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text(reg.ParticipantEmail).Style(rowStyle);
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text(reg.ParticipantPhone ?? "-").Style(rowStyle);
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .AlignCenter().Text($"{reg.NumberOfGuests}").Style(rowStyle);
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text(StatusLabel(reg.Status)).Style(rowStyle.FontColor(StatusColor(reg.Status)));
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text(reg.RegisteredAt.ToString("dd.MM.yyyy HH:mm")).Style(rowStyle);
                table.Cell().Background(bg).PaddingVertical(4).PaddingHorizontal(4)
                    .Text(reg.Notes ?? "").Style(rowStyle);
            }
        });
    }

    private static void ComposeFooter(IContainer container)
    {
        container.Row(row =>
        {
            row.RelativeItem().Text(text =>
            {
                text.Span($"Erstellt am {DateTime.Now:dd.MM.yyyy HH:mm}")
                    .FontSize(7).FontColor(TextMuted);
            });
            row.RelativeItem().AlignRight().Text(text =>
            {
                text.DefaultTextStyle(x => x.FontSize(7).FontColor(TextMuted));
                text.Span("Seite ");
                text.CurrentPageNumber();
                text.Span(" von ");
                text.TotalPages();
            });
        });
    }

    private static string StatusLabel(RegistrationStatus status) => status switch
    {
        RegistrationStatus.Pending => "Ausstehend",
        RegistrationStatus.Confirmed => "Bestätigt",
        RegistrationStatus.Cancelled => "Storniert",
        RegistrationStatus.Waitlisted => "Warteliste",
        RegistrationStatus.CheckedIn => "Eingecheckt",
        RegistrationStatus.NoShow => "Nicht erschienen",
        _ => status.ToString()
    };

    private static string StatusColor(RegistrationStatus status) => status switch
    {
        RegistrationStatus.Confirmed => "#15803D",
        RegistrationStatus.CheckedIn => "#059669",
        RegistrationStatus.Waitlisted => "#1D4ED8",
        RegistrationStatus.Cancelled => "#DC2626",
        RegistrationStatus.NoShow => "#6B7280",
        _ => "#111827"
    };
}
