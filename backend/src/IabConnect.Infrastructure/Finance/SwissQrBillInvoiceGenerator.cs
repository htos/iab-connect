using Codecrete.SwissQRBill.Generator;
using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using QuestPDF.Fluent;
using QuestPDF.Infrastructure;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-063: Swiss QR-bill invoice PDF generator.
/// Extends the base <see cref="QuestPdfInvoiceGenerator"/> by overriding
/// <see cref="ComposeAdditionalSections"/> to append a Swiss QR payment slip
/// (QR-Zahlteil) conforming to the SIX Group specification.
///
/// The QR-bill section includes:
/// - Payment part (Zahlteil) with QR code containing structured payment data
/// - Receipt part (Empfangsschein)
/// - Creditor info from the active FinanceProfile
/// - Amount and currency from the invoice
/// - Structured reference (QR-Reference or Creditor Reference / ISO 11649)
/// - Debtor info from the invoice recipient
/// </summary>
public class SwissQrBillInvoiceGenerator : QuestPdfInvoiceGenerator
{
    private readonly ILogger<SwissQrBillInvoiceGenerator> _swissLogger;

    public SwissQrBillInvoiceGenerator(
        IOptions<InvoiceSettings> settings,
        IFinanceProfileRepository profileRepository,
        ILogger<SwissQrBillInvoiceGenerator> logger)
        : base(settings, profileRepository, logger)
    {
        _swissLogger = logger;
    }

    /// <summary>
    /// Appends the Swiss QR-bill payment slip after the invoice content.
    /// The QR-bill is generated using Codecrete.SwissQRBill.Generator and
    /// rendered as a PNG image embedded in the PDF.
    /// </summary>
    protected override void ComposeAdditionalSections(IContainer container, Invoice invoice)
    {
        if (_activeProfile?.BankIban is not { Length: > 0 })
        {
            _swissLogger.LogWarning(
                "Cannot generate QR-bill for invoice {InvoiceNumber}: no IBAN configured in FinanceProfile",
                invoice.InvoiceNumber);
            base.ComposeAdditionalSections(container, invoice);
            return;
        }

        try
        {
            var qrBillPng = GenerateQrBillImage(invoice, _activeProfile);

            container.Column(col =>
            {
                // Force QR-bill onto a new page for clean separation
                col.Item().PageBreak();

                // Dashed separator line representing the perforation (Abtrennlinie)
                col.Item().PaddingBottom(5)
                    .LineHorizontal(0.5f).LineColor("#CCCCCC");

                // Embed the QR-bill image (payment slip + receipt)
                // Note: The QR-bill is rendered within page margins. For edge-to-edge
                // compliance with SIX specifications, a custom page layout would be needed.
                col.Item().Image(qrBillPng);
            });

            _swissLogger.LogInformation(
                "Swiss QR-bill appended to invoice {InvoiceNumber}", invoice.InvoiceNumber);
        }
        catch (Exception ex)
        {
            _swissLogger.LogError(ex,
                "Failed to generate Swiss QR-bill for invoice {InvoiceNumber}. " +
                "Falling back to base template.", invoice.InvoiceNumber);
            base.ComposeAdditionalSections(container, invoice);
        }
    }

    /// <summary>
    /// Generates the QR-bill payment slip as a PNG byte array using the
    /// Codecrete.SwissQRBill.Generator library.
    /// </summary>
    private byte[] GenerateQrBillImage(Invoice invoice, FinanceProfile profile)
    {
        var cleanIban = profile.BankIban!.Replace(" ", "");

        // Build creditor address from FinanceProfile
        var creditor = new Address
        {
            Name = profile.OrganizationName,
            Street = profile.OrganizationAddress,
            PostalCode = profile.OrganizationPostalCode,
            Town = profile.OrganizationCity,
            CountryCode = profile.OrganizationCountry
        };

        // Build debtor address from invoice recipient (optional per SIX spec)
        Address? debtor = null;
        if (!string.IsNullOrWhiteSpace(invoice.RecipientName))
        {
            debtor = new Address
            {
                Name = invoice.RecipientName,
                CountryCode = profile.OrganizationCountry
            };
        }

        // Generate the structured reference
        var reference = SwissQrReferenceHelper.GenerateReference(cleanIban, invoice.InvoiceNumber);

        var bill = new Bill
        {
            Account = cleanIban,
            Creditor = creditor,
            Amount = invoice.Total,
            Currency = _currency,
            Debtor = debtor,
            Reference = reference,
            UnstructuredMessage = $"Invoice {invoice.InvoiceNumber}",
            Format = new BillFormat
            {
                OutputSize = OutputSize.QrBillOnly,
                GraphicsFormat = GraphicsFormat.PNG,
                Language = Language.DE,
                SeparatorType = SeparatorType.DashedLineWithScissors
            }
        };

        _swissLogger.LogDebug(
            "Generating QR-bill for invoice {InvoiceNumber}: IBAN={Iban}, Amount={Amount} {Currency}, Reference={Reference}",
            invoice.InvoiceNumber, cleanIban, invoice.Total, _currency, reference);

        return QRBill.Generate(bill);
    }
}
