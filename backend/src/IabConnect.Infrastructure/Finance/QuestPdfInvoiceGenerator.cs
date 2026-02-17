using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-039: Generates professional invoice PDFs using QuestPDF.
///
/// REQ-060: If an active FinanceProfile exists, its organization details and
/// currency are used instead of InvoiceSettings from appsettings.json.
///
/// Extensibility design (template method pattern):
/// - <see cref="ComposeHeader"/>: Organization branding + logo placeholder
/// - <see cref="ComposeInvoiceMetadata"/>: Invoice details + billing info
/// - <see cref="ComposeItemsTable"/>: Line items table
/// - <see cref="ComposeTotals"/>: Subtotal, tax, total
/// - <see cref="ComposeAdditionalSections"/>: Hook for VAT summary (REQ-062), QR-bill (REQ-063), etc.
/// - <see cref="ComposeFooter"/>: Payment instructions + contact
///
/// Override individual methods or replace the entire generator via DI to support
/// jurisdiction-specific templates (REQ-064).
/// </summary>
public class QuestPdfInvoiceGenerator : IInvoicePdfGenerator
{
    private readonly InvoiceSettings _settings;
    private readonly IFinanceProfileRepository _profileRepository;
    protected readonly ILogger _logger;

    // Resolved values (populated per-generate call)
    protected string _orgName = string.Empty;
    protected string _orgAddress = string.Empty;
    protected string _orgEmail = string.Empty;
    protected string _currency = string.Empty;
    protected string _paymentInstructions = string.Empty;
    protected FinanceProfile? _activeProfile;
    protected InvoiceTemplate? _template;

    // Design constants
    private static readonly string PrimaryColor = "#2C3E50";
    private static readonly string AccentColor = "#3498DB";
    private static readonly string LightGray = "#F8F9FA";
    private static readonly string MediumGray = "#6C757D";
    private static readonly string BorderColor = "#DEE2E6";

    public QuestPdfInvoiceGenerator(
        IOptions<InvoiceSettings> settings,
        IFinanceProfileRepository profileRepository,
        ILogger<QuestPdfInvoiceGenerator> logger)
    {
        _settings = settings.Value;
        _profileRepository = profileRepository;
        _logger = logger;
    }

    /// <summary>
    /// Protected constructor for derived classes with their own logger category.
    /// </summary>
    protected QuestPdfInvoiceGenerator(
        IOptions<InvoiceSettings> settings,
        IFinanceProfileRepository profileRepository,
        ILogger logger)
    {
        _settings = settings.Value;
        _profileRepository = profileRepository;
        _logger = logger;
    }

    public async Task<byte[]> GenerateInvoicePdfAsync(Invoice invoice)
    {
        return await GenerateInvoicePdfAsync(invoice, null);
    }

    public async Task<byte[]> GenerateInvoicePdfAsync(Invoice invoice, InvoiceTemplate? template)
    {
        _template = template;
        _logger.LogInformation("Generating PDF for invoice {InvoiceNumber}", invoice.InvoiceNumber);

        // REQ-060: Prefer FinanceProfile over InvoiceSettings
        var profile = await _profileRepository.GetActiveProfileAsync();
        _activeProfile = profile;
        if (profile is not null)
        {
            _orgName = profile.OrganizationName;
            _orgAddress = $"{profile.OrganizationAddress}, {profile.OrganizationPostalCode} {profile.OrganizationCity}";
            _orgEmail = profile.OrganizationEmail ?? _settings.OrganizationEmail;
            _currency = profile.Currency.ToString();
            _paymentInstructions = _settings.PaymentInstructions;
            _logger.LogInformation("Using FinanceProfile for invoice generation (Jurisdiction: {Jurisdiction})", profile.Jurisdiction);
        }
        else
        {
            _orgName = _settings.OrganizationName;
            _orgAddress = _settings.OrganizationAddress;
            _orgEmail = _settings.OrganizationEmail;
            _currency = _settings.Currency;
            _paymentInstructions = _settings.PaymentInstructions;
        }

        var document = Document.Create(container =>
        {
            container.Page(page =>
            {
                page.Size(PageSizes.A4);
                page.MarginTop(40);
                page.MarginBottom(30);
                page.MarginHorizontal(40);
                page.DefaultTextStyle(x => x.FontSize(10).FontColor(PrimaryColor));

                page.Header().Element(header => ComposeHeader(header, invoice));

                page.Content().Element(content => ComposeContent(content, invoice));

                page.Footer().Element(footer => ComposeFooter(footer));
            });
        });

        var pdfBytes = document.GeneratePdf();

        _logger.LogInformation("PDF generated for invoice {InvoiceNumber} ({Bytes} bytes)",
            invoice.InvoiceNumber, pdfBytes.Length);

        return pdfBytes;
    }

    /// <summary>
    /// Composes the page header with organization name and invoice title.
    /// Override to add a logo or custom branding.
    /// </summary>
    protected virtual void ComposeHeader(IContainer container, Invoice invoice)
    {
        container.Column(column =>
        {
            column.Item().Row(row =>
            {
                row.RelativeItem().Column(col =>
                {
                    col.Item().Text(_orgName)
                        .FontSize(18).Bold().FontColor(PrimaryColor);
                    col.Item().Text(_orgAddress)
                        .FontSize(9).FontColor(MediumGray);
                    col.Item().Text(_orgEmail)
                        .FontSize(9).FontColor(MediumGray);
                });

                // Logo placeholder — replace with actual logo image later
                row.ConstantItem(80).Height(50)
                    .Background(LightGray)
                    .AlignCenter().AlignMiddle()
                    .Text("LOGO").FontSize(9).FontColor(MediumGray);
            });

            column.Item().PaddingTop(15)
                .LineHorizontal(1).LineColor(AccentColor);
        });
    }

    /// <summary>
    /// Composes the main content area: metadata, items table, totals, and additional sections.
    /// </summary>
    protected virtual void ComposeContent(IContainer container, Invoice invoice)
    {
        container.PaddingTop(15).Column(column =>
        {
            // Invoice title
            column.Item().Text($"Invoice {invoice.InvoiceNumber}")
                .FontSize(20).Bold().FontColor(PrimaryColor);

            column.Item().PaddingTop(15).Element(c => ComposeInvoiceMetadata(c, invoice));
            column.Item().PaddingTop(20).Element(c => ComposeItemsTable(c, invoice));
            column.Item().PaddingTop(10).Element(c => ComposeTotals(c, invoice));

            // Hook for additional sections (QR-bill, VAT summary, etc.)
            column.Item().PaddingTop(15).Element(c => ComposeAdditionalSections(c, invoice));

            // Notes
            if (!string.IsNullOrWhiteSpace(invoice.Notes))
            {
                column.Item().PaddingTop(15).Column(notesCol =>
                {
                    notesCol.Item().Text("Notes").Bold().FontSize(10);
                    notesCol.Item().PaddingTop(3).Text(invoice.Notes).FontSize(9).FontColor(MediumGray);
                });
            }
        });
    }

    /// <summary>
    /// Composes invoice metadata: dates, status, and billing information.
    /// </summary>
    protected virtual void ComposeInvoiceMetadata(IContainer container, Invoice invoice)
    {
        container.Row(row =>
        {
            // Invoice details (left)
            row.RelativeItem().Column(col =>
            {
                col.Item().Text("Invoice Details").Bold().FontSize(11).FontColor(PrimaryColor);
                col.Item().PaddingTop(5).Row(r =>
                {
                    r.ConstantItem(100).Text("Date:").FontColor(MediumGray);
                    r.RelativeItem().Text(invoice.Date.ToString("dd.MM.yyyy"));
                });
                col.Item().Row(r =>
                {
                    r.ConstantItem(100).Text("Due Date:").FontColor(MediumGray);
                    r.RelativeItem().Text(invoice.DueDate.ToString("dd.MM.yyyy"));
                });
                col.Item().Row(r =>
                {
                    r.ConstantItem(100).Text("Status:").FontColor(MediumGray);
                    r.RelativeItem().Text(invoice.Status.ToString())
                        .Bold().FontColor(GetStatusColor(invoice.Status));
                });
            });

            row.ConstantItem(20);

            // Bill To (right)
            row.RelativeItem().Column(col =>
            {
                col.Item().Text("Bill To").Bold().FontSize(11).FontColor(PrimaryColor);
                col.Item().PaddingTop(5).Text(invoice.RecipientName).Bold();
                if (!string.IsNullOrWhiteSpace(invoice.RecipientAddress))
                {
                    col.Item().Text(invoice.RecipientAddress).FontColor(MediumGray);
                }
                col.Item().Text($"Type: {invoice.RecipientType}").FontSize(9).FontColor(MediumGray);
            });
        });
    }

    /// <summary>
    /// Composes the line items table.
    /// REQ-062: Shows VAT columns when items have tax data.
    /// </summary>
    protected virtual void ComposeItemsTable(IContainer container, Invoice invoice)
    {
        var hasTaxData = invoice.Items.Any(i => i.TaxRate.HasValue && i.TaxRate > 0);

        container.Table(table =>
        {
            if (hasTaxData)
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(4); // Description
                    columns.ConstantColumn(45); // Quantity
                    columns.ConstantColumn(70); // Unit Price
                    columns.ConstantColumn(70); // Net
                    columns.ConstantColumn(45); // Tax %
                    columns.ConstantColumn(60); // Tax Amount
                    columns.ConstantColumn(70); // Gross
                });

                // Header row
                table.Header(header =>
                {
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .Text("Description").FontColor(Colors.White).Bold().FontSize(8);
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .AlignRight().Text("Qty").FontColor(Colors.White).Bold().FontSize(8);
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .AlignRight().Text("Unit Price").FontColor(Colors.White).Bold().FontSize(8);
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .AlignRight().Text("Net").FontColor(Colors.White).Bold().FontSize(8);
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .AlignRight().Text("Tax %").FontColor(Colors.White).Bold().FontSize(8);
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .AlignRight().Text("Tax").FontColor(Colors.White).Bold().FontSize(8);
                    header.Cell().Background(PrimaryColor).Padding(5)
                        .AlignRight().Text("Gross").FontColor(Colors.White).Bold().FontSize(8);
                });

                var isAlternate = false;
                foreach (var item in invoice.Items)
                {
                    var bgColor = isAlternate ? LightGray : "#FFFFFF";
                    var rateDisplay = item.TaxRate.HasValue ? $"{item.TaxRate.Value * 100:N1}%" : "—";

                    table.Cell().Background(bgColor).Padding(5)
                        .Text(item.Description).FontSize(8);
                    table.Cell().Background(bgColor).Padding(5)
                        .AlignRight().Text(item.Quantity.ToString("N2")).FontSize(8);
                    table.Cell().Background(bgColor).Padding(5)
                        .AlignRight().Text($"{_currency} {item.UnitPrice:N2}").FontSize(8);
                    table.Cell().Background(bgColor).Padding(5)
                        .AlignRight().Text($"{_currency} {(item.NetAmount ?? item.Amount):N2}").FontSize(8);
                    table.Cell().Background(bgColor).Padding(5)
                        .AlignRight().Text(rateDisplay).FontSize(8);
                    table.Cell().Background(bgColor).Padding(5)
                        .AlignRight().Text($"{_currency} {(item.TaxAmount ?? 0):N2}").FontSize(8);
                    table.Cell().Background(bgColor).Padding(5)
                        .AlignRight().Text($"{_currency} {(item.GrossAmount ?? item.Amount):N2}").FontSize(8);

                    isAlternate = !isAlternate;
                }
            }
            else
            {
                table.ColumnsDefinition(columns =>
                {
                    columns.RelativeColumn(4); // Description
                    columns.ConstantColumn(60); // Quantity
                    columns.ConstantColumn(90); // Unit Price
                    columns.ConstantColumn(90); // Amount
                });

                // Header row
                table.Header(header =>
                {
                    header.Cell().Background(PrimaryColor).Padding(6)
                        .Text("Description").FontColor(Colors.White).Bold().FontSize(9);
                    header.Cell().Background(PrimaryColor).Padding(6)
                        .AlignRight().Text("Qty").FontColor(Colors.White).Bold().FontSize(9);
                    header.Cell().Background(PrimaryColor).Padding(6)
                        .AlignRight().Text("Unit Price").FontColor(Colors.White).Bold().FontSize(9);
                    header.Cell().Background(PrimaryColor).Padding(6)
                        .AlignRight().Text("Amount").FontColor(Colors.White).Bold().FontSize(9);
                });

                var isAlternate = false;
                foreach (var item in invoice.Items)
                {
                    var bgColor = isAlternate ? LightGray : "#FFFFFF";

                    table.Cell().Background(bgColor).Padding(6)
                        .Text(item.Description).FontSize(9);
                    table.Cell().Background(bgColor).Padding(6)
                        .AlignRight().Text(item.Quantity.ToString("N2")).FontSize(9);
                    table.Cell().Background(bgColor).Padding(6)
                        .AlignRight().Text($"{_currency} {item.UnitPrice:N2}").FontSize(9);
                    table.Cell().Background(bgColor).Padding(6)
                        .AlignRight().Text($"{_currency} {item.Amount:N2}").FontSize(9);

                    isAlternate = !isAlternate;
                }
            }
        });
    }

    /// <summary>
    /// Composes the totals section: subtotal, tax, and total.
    /// REQ-062: Shows net/tax/gross breakdown when per-item VAT is used.
    /// </summary>
    protected virtual void ComposeTotals(IContainer container, Invoice invoice)
    {
        var hasPerItemTax = invoice.Items.Any(i => i.TaxRate.HasValue && i.TaxRate > 0);

        container.AlignRight().Width(250).Column(col =>
        {
            if (hasPerItemTax)
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem().AlignRight().Padding(4)
                        .Text("Net Subtotal:").FontColor(MediumGray);
                    row.ConstantItem(120).AlignRight().Padding(4)
                        .Text($"{_currency} {invoice.SubtotalNet:N2}");
                });

                col.Item().Row(row =>
                {
                    row.RelativeItem().AlignRight().Padding(4)
                        .Text("Total Tax:").FontColor(MediumGray);
                    row.ConstantItem(120).AlignRight().Padding(4)
                        .Text($"{_currency} {invoice.TotalTax:N2}");
                });
            }
            else
            {
                col.Item().Row(row =>
                {
                    row.RelativeItem().AlignRight().Padding(4)
                        .Text("Subtotal:").FontColor(MediumGray);
                    row.ConstantItem(120).AlignRight().Padding(4)
                        .Text($"{_currency} {invoice.SubTotal:N2}");
                });

                if (invoice.TaxRate > 0)
                {
                    col.Item().Row(row =>
                    {
                        row.RelativeItem().AlignRight().Padding(4)
                            .Text($"Tax ({invoice.TaxRate:N1}%):").FontColor(MediumGray);
                        row.ConstantItem(120).AlignRight().Padding(4)
                            .Text($"{_currency} {invoice.TaxAmount:N2}");
                    });
                }
            }

            col.Item().LineHorizontal(1).LineColor(BorderColor);

            col.Item().Row(row =>
            {
                row.RelativeItem().AlignRight().Padding(4)
                    .Text("Total:").Bold().FontSize(12);
                row.ConstantItem(120).AlignRight().Padding(4)
                    .Text($"{_currency} {invoice.Total:N2}").Bold().FontSize(12);
            });
        });
    }

    /// <summary>
    /// Hook point for additional sections.
    /// REQ-062: Renders VAT summary grouped by tax rate when items have tax data.
    /// REQ-064: Renders EU compliance fields from InvoiceTemplate.
    /// Override to add Swiss QR-bill (REQ-063), jurisdiction-specific blocks (REQ-064), etc.
    /// </summary>
    protected virtual void ComposeAdditionalSections(IContainer container, Invoice invoice)
    {
        container.Column(outerCol =>
        {
            // REQ-062: VAT summary breakdown grouped by tax rate
            var taxGroups = invoice.Items
                .Where(i => i.TaxRate.HasValue)
                .GroupBy(i => i.TaxRate!.Value)
                .Select(g => new
                {
                    Rate = g.Key,
                    Net = g.Sum(i => i.NetAmount ?? i.Amount),
                    Tax = g.Sum(i => i.TaxAmount ?? 0m),
                    Gross = g.Sum(i => i.GrossAmount ?? i.Amount)
                })
                .OrderBy(g => g.Rate)
                .ToList();

            if (taxGroups.Count > 0)
            {
                outerCol.Item().Column(col =>
                {
                    col.Item().Text("VAT Summary (MWST-Zusammenfassung)").Bold().FontSize(10).FontColor(PrimaryColor);

                    col.Item().PaddingTop(5).Table(table =>
                    {
                        table.ColumnsDefinition(columns =>
                        {
                            columns.ConstantColumn(80);  // Rate
                            columns.ConstantColumn(100); // Net
                            columns.ConstantColumn(100); // Tax
                            columns.ConstantColumn(100); // Gross
                        });

                        table.Header(header =>
                        {
                            header.Cell().Background(LightGray).Padding(4)
                                .Text("Tax Rate").Bold().FontSize(8);
                            header.Cell().Background(LightGray).Padding(4)
                                .AlignRight().Text("Net Amount").Bold().FontSize(8);
                            header.Cell().Background(LightGray).Padding(4)
                                .AlignRight().Text("Tax Amount").Bold().FontSize(8);
                            header.Cell().Background(LightGray).Padding(4)
                                .AlignRight().Text("Gross Amount").Bold().FontSize(8);
                        });

                        foreach (var g in taxGroups)
                        {
                            table.Cell().Padding(4)
                                .Text($"{g.Rate * 100:N1}%").FontSize(8);
                            table.Cell().Padding(4)
                                .AlignRight().Text($"{_currency} {g.Net:N2}").FontSize(8);
                            table.Cell().Padding(4)
                                .AlignRight().Text($"{_currency} {g.Tax:N2}").FontSize(8);
                            table.Cell().Padding(4)
                                .AlignRight().Text($"{_currency} {g.Gross:N2}").FontSize(8);
                        }
                    });

                    // Show organization's VAT number if available
                    if (ShowVatIdOnPdf())
                    {
                        col.Item().PaddingTop(5)
                            .Text($"UID/MWST-Nr: {_activeProfile!.VatNumber}")
                            .FontSize(8).FontColor(MediumGray);
                    }
                });
            }
            else if (ShowVatIdOnPdf())
            {
                // Show VAT ID even without per-item tax groups if template says so
                outerCol.Item().PaddingTop(5)
                    .Text($"VAT-ID: {_activeProfile!.VatNumber}")
                    .FontSize(8).FontColor(MediumGray);
            }

            // REQ-064: EU compliance notes from template
            ComposeTemplateComplianceNotes(outerCol, invoice);
        });
    }

    /// <summary>
    /// REQ-064: Renders EU compliance notes (tax exemption, reverse charge, payment terms)
    /// from the associated InvoiceTemplate.
    /// </summary>
    protected virtual void ComposeTemplateComplianceNotes(ColumnDescriptor col, Invoice invoice)
    {
        if (_template is null) return;

        if (_template.ShowTaxExemptionNote && !string.IsNullOrWhiteSpace(_template.TaxExemptionNote))
        {
            col.Item().PaddingTop(8)
                .Text(_template.TaxExemptionNote)
                .FontSize(9).Bold().FontColor(MediumGray);
        }

        if (_template.ShowReverseChargeNote && !string.IsNullOrWhiteSpace(_template.ReverseChargeNote))
        {
            col.Item().PaddingTop(4)
                .Text(_template.ReverseChargeNote)
                .FontSize(9).Bold().FontColor(MediumGray);
        }

        // Payment terms: prefer invoice-level, fall back to template default
        var paymentTerms = invoice.PaymentTerms ?? _template.DefaultPaymentTerms;
        if (_template.ShowPaymentTerms && !string.IsNullOrWhiteSpace(paymentTerms))
        {
            col.Item().PaddingTop(8).Column(ptCol =>
            {
                ptCol.Item().Text("Payment Terms").Bold().FontSize(9).FontColor(PrimaryColor);
                ptCol.Item().PaddingTop(2).Text(paymentTerms).FontSize(9).FontColor(MediumGray);
            });
        }

        if (!string.IsNullOrWhiteSpace(_template.LegalNotice))
        {
            col.Item().PaddingTop(8)
                .Text(_template.LegalNotice)
                .FontSize(8).FontColor(MediumGray);
        }
    }

    /// <summary>
    /// Determines whether to show the VAT ID on the PDF based on template and profile.
    /// </summary>
    private bool ShowVatIdOnPdf()
    {
        var showFromTemplate = _template?.ShowVatId ?? true;
        return showFromTemplate
               && _activeProfile?.VatStatus == VatStatus.Registered
               && !string.IsNullOrWhiteSpace(_activeProfile.VatNumber);
    }

    /// <summary>
    /// Composes the page footer with payment instructions, organization contact,
    /// and REQ-064 template footer/bank details.
    /// </summary>
    protected virtual void ComposeFooter(IContainer container)
    {
        container.Column(col =>
        {
            col.Item().LineHorizontal(1).LineColor(BorderColor);

            col.Item().PaddingTop(5).Row(row =>
            {
                row.RelativeItem().Column(footerCol =>
                {
                    // REQ-064: Template footer text takes priority, falls back to payment instructions
                    var footerText = _template?.FooterText;
                    if (!string.IsNullOrWhiteSpace(footerText))
                    {
                        footerCol.Item().Text(footerText)
                            .FontSize(8).FontColor(MediumGray);
                    }
                    else
                    {
                        footerCol.Item().Text(_paymentInstructions)
                            .FontSize(8).FontColor(MediumGray);
                    }

                    // REQ-064: Show bank details from profile if template says so
                    if (_template is { ShowBankDetails: true } && _activeProfile is not null)
                    {
                        if (!string.IsNullOrWhiteSpace(_activeProfile.BankIban))
                        {
                            footerCol.Item().PaddingTop(2)
                                .Text($"IBAN: {_activeProfile.BankIban}")
                                .FontSize(8).FontColor(MediumGray);
                        }
                        if (!string.IsNullOrWhiteSpace(_activeProfile.BankBic))
                        {
                            footerCol.Item()
                                .Text($"BIC: {_activeProfile.BankBic}")
                                .FontSize(8).FontColor(MediumGray);
                        }
                        if (!string.IsNullOrWhiteSpace(_activeProfile.BankName))
                        {
                            footerCol.Item()
                                .Text($"Bank: {_activeProfile.BankName}")
                                .FontSize(8).FontColor(MediumGray);
                        }
                    }
                });

                row.ConstantItem(150).AlignRight().Column(footerCol =>
                {
                    footerCol.Item().Text(_orgName)
                        .FontSize(8).FontColor(MediumGray);
                    footerCol.Item().Text(_orgEmail)
                        .FontSize(8).FontColor(MediumGray);
                });
            });

            col.Item().AlignCenter().PaddingTop(3)
                .Text(text =>
                {
                    text.Span("Page ").FontSize(8).FontColor(MediumGray);
                    text.CurrentPageNumber().FontSize(8).FontColor(MediumGray);
                    text.Span(" of ").FontSize(8).FontColor(MediumGray);
                    text.TotalPages().FontSize(8).FontColor(MediumGray);
                });
        });
    }

    private static string GetStatusColor(InvoiceStatus status) => status switch
    {
        InvoiceStatus.Draft => MediumGray,
        InvoiceStatus.Sent => AccentColor,
        InvoiceStatus.Paid => "#27AE60",
        InvoiceStatus.Overdue => "#E74C3C",
        InvoiceStatus.Cancelled => "#95A5A6",
        _ => PrimaryColor
    };
}
