using System.Globalization;
using System.Text;
using System.Xml.Linq;
using IabConnect.Application.Finance.Invoices;
using IabConnect.Domain.Finance;

namespace IabConnect.Infrastructure.Finance;

/// <summary>
/// REQ-065: Generates EN 16931 compliant UBL 2.1 Invoice XML.
/// EU-generic baseline — no country-specific CIUS applied.
///
/// References:
/// - EN 16931-1:2017 (European standard for electronic invoicing)
/// - OASIS UBL 2.1 (syntax binding)
/// - BT/BG identifiers from EN 16931 are noted in comments
/// </summary>
public class UblInvoiceExporter : IEInvoiceExporter
{
    // UBL 2.1 namespaces
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Inv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";

    public EInvoiceFormat Format => EInvoiceFormat.UBL;

    public Task<byte[]> ExportAsync(Invoice invoice, FinanceProfile profile, IReadOnlyList<TaxCode> taxCodes, CancellationToken ct = default)
    {
        var currencyCode = profile.Currency.ToString();
        var doc = BuildUblInvoice(invoice, profile, taxCodes, currencyCode);

        using var ms = new MemoryStream();
        using (var writer = new StreamWriter(ms, new UTF8Encoding(false), leaveOpen: true))
        {
            doc.Save(writer);
        }

        return Task.FromResult(ms.ToArray());
    }

    private XDocument BuildUblInvoice(Invoice invoice, FinanceProfile profile, IReadOnlyList<TaxCode> taxCodes, string currencyCode)
    {
        var elements = new List<object>
        {
            new XAttribute(XNamespace.Xmlns + "cbc", Cbc.NamespaceName),
            new XAttribute(XNamespace.Xmlns + "cac", Cac.NamespaceName),

            // BT-24: Specification identifier (EN 16931)
            new XElement(Cbc + "CustomizationID", "urn:cen.eu:en16931:2017"),
            // BT-23: Business process type
            new XElement(Cbc + "ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"),

            // BT-1: Invoice number
            new XElement(Cbc + "ID", invoice.InvoiceNumber),

            // BT-2: Invoice issue date
            new XElement(Cbc + "IssueDate", invoice.Date.ToString("yyyy-MM-dd")),

            // BT-9: Payment due date
            new XElement(Cbc + "DueDate", invoice.DueDate.ToString("yyyy-MM-dd")),

            // BT-3: Invoice type code (380 = Commercial Invoice)
            new XElement(Cbc + "InvoiceTypeCode", "380"),
        };

        // BT-22: Notes (optional)
        if (!string.IsNullOrWhiteSpace(invoice.Notes))
        {
            elements.Add(new XElement(Cbc + "Note", invoice.Notes));
        }

        // BT-5: Invoice currency code
        elements.Add(new XElement(Cbc + "DocumentCurrencyCode", currencyCode));

        // BG-4: Seller (AccountingSupplierParty)
        elements.Add(BuildSellerParty(profile));

        // BG-7: Buyer (AccountingCustomerParty)
        elements.Add(BuildBuyerParty(invoice));

        // BG-16: Payment means
        elements.Add(BuildPaymentMeans(profile, invoice));

        // BT-20: Payment terms (optional)
        if (!string.IsNullOrWhiteSpace(invoice.PaymentTerms))
        {
            elements.Add(new XElement(Cac + "PaymentTerms",
                new XElement(Cbc + "Note", invoice.PaymentTerms)));
        }

        // BG-23: VAT breakdown
        elements.Add(BuildTaxTotal(invoice, taxCodes, currencyCode));

        // BG-22: Document totals (LegalMonetaryTotal)
        elements.Add(BuildLegalMonetaryTotal(invoice, currencyCode));

        // BG-25: Invoice lines
        elements.AddRange(BuildInvoiceLines(invoice, taxCodes, currencyCode));

        var doc = new XDocument(
            new XDeclaration("1.0", "UTF-8", null),
            new XElement(Inv + "Invoice", elements.ToArray())
        );

        return doc;
    }

    /// <summary>BG-4: Seller party</summary>
    private XElement BuildSellerParty(FinanceProfile profile)
    {
        var partyElements = new List<XElement>();

        // BT-27: Seller name
        partyElements.Add(new XElement(Cac + "PartyName",
            new XElement(Cbc + "Name", profile.OrganizationName)));

        // BG-5: Seller postal address
        var addressElements = new List<XElement>
        {
            new(Cbc + "StreetName", profile.OrganizationAddress),
            new(Cbc + "CityName", profile.OrganizationCity),
            new(Cbc + "PostalZone", profile.OrganizationPostalCode),
            new(Cac + "Country", new XElement(Cbc + "IdentificationCode", profile.OrganizationCountry))
        };
        partyElements.Add(new XElement(Cac + "PostalAddress", addressElements));

        // BT-31: Seller VAT identifier
        if (profile.VatStatus == VatStatus.Registered && !string.IsNullOrWhiteSpace(profile.VatNumber))
        {
            partyElements.Add(new XElement(Cac + "PartyTaxScheme",
                new XElement(Cbc + "CompanyID", profile.VatNumber),
                new XElement(Cac + "TaxScheme",
                    new XElement(Cbc + "ID", "VAT"))));
        }

        // BT-30: Seller legal registration
        var legalElements = new List<XElement>
        {
            new(Cbc + "RegistrationName", profile.OrganizationName)
        };
        if (!string.IsNullOrWhiteSpace(profile.OrganizationUid))
        {
            legalElements.Add(new XElement(Cbc + "CompanyID", profile.OrganizationUid));
        }
        partyElements.Add(new XElement(Cac + "PartyLegalEntity", legalElements));

        // BT-42: Seller contact (email)
        if (!string.IsNullOrWhiteSpace(profile.OrganizationEmail))
        {
            partyElements.Add(new XElement(Cac + "Contact",
                new XElement(Cbc + "ElectronicMail", profile.OrganizationEmail)));
        }

        return new XElement(Cac + "AccountingSupplierParty",
            new XElement(Cac + "Party", partyElements));
    }

    /// <summary>BG-7: Buyer party</summary>
    private XElement BuildBuyerParty(Invoice invoice)
    {
        var partyElements = new List<XElement>
        {
            new(Cac + "PartyName",
                new XElement(Cbc + "Name", invoice.RecipientName))
        };

        // BG-8: Buyer postal address — use recipientAddress if available
        if (!string.IsNullOrWhiteSpace(invoice.RecipientAddress))
        {
            partyElements.Add(new XElement(Cac + "PostalAddress",
                new XElement(Cbc + "StreetName", invoice.RecipientAddress),
                new XElement(Cac + "Country",
                    new XElement(Cbc + "IdentificationCode", "XX"))));  // Unknown — minimum required
        }

        partyElements.Add(new XElement(Cac + "PartyLegalEntity",
            new XElement(Cbc + "RegistrationName", invoice.RecipientName)));

        return new XElement(Cac + "AccountingCustomerParty",
            new XElement(Cac + "Party", partyElements));
    }

    /// <summary>BG-16: Payment means</summary>
    private XElement BuildPaymentMeans(FinanceProfile profile, Invoice invoice)
    {
        var elements = new List<XElement>
        {
            // BT-81: Payment means type code (30 = credit transfer, 58 = SEPA)
            new(Cbc + "PaymentMeansCode", !string.IsNullOrWhiteSpace(profile.BankIban) ? "58" : "30")
        };

        // BT-83: Remittance information (invoice number as reference)
        elements.Add(new XElement(Cbc + "PaymentID", invoice.InvoiceNumber));

        // BG-17: Credit transfer (bank account)
        if (!string.IsNullOrWhiteSpace(profile.BankIban))
        {
            var financialAccount = new List<XElement>
            {
                new(Cbc + "ID", profile.BankIban)
            };

            if (!string.IsNullOrWhiteSpace(profile.BankName))
            {
                financialAccount.Add(new XElement(Cbc + "Name", profile.BankName));
            }

            if (!string.IsNullOrWhiteSpace(profile.BankBic))
            {
                financialAccount.Add(new XElement(Cac + "FinancialInstitutionBranch",
                    new XElement(Cbc + "ID", profile.BankBic)));
            }

            elements.Add(new XElement(Cac + "PayeeFinancialAccount", financialAccount));
        }

        return new XElement(Cac + "PaymentMeans", elements);
    }

    /// <summary>BG-23: VAT breakdown (TaxTotal)</summary>
    private XElement BuildTaxTotal(Invoice invoice, IReadOnlyList<TaxCode> taxCodes, string currencyCode)
    {
        var taxSubtotals = new List<XElement>();

        // Group items by tax rate
        var taxGroups = invoice.Items
            .GroupBy(i => i.TaxRate ?? 0m)
            .Select(g => new
            {
                Rate = g.Key,
                TaxableAmount = g.Sum(i => i.NetAmount ?? i.Amount),
                TaxAmount = g.Sum(i => i.TaxAmount ?? 0m),
                // Try to find the matching TaxCode for the category code
                TaxCode = g.First().TaxCodeId.HasValue
                    ? taxCodes.FirstOrDefault(tc => tc.Id == g.First().TaxCodeId!.Value)
                    : null
            })
            .ToList();

        if (taxGroups.Count == 0)
        {
            // No items — add a zero-rated entry
            taxGroups.Add(new
            {
                Rate = 0m,
                TaxableAmount = invoice.SubTotal,
                TaxAmount = 0m,
                TaxCode = (TaxCode?)null
            });
        }

        foreach (var group in taxGroups)
        {
            var categoryCode = DetermineVatCategoryCode(group.Rate, group.TaxCode);

            taxSubtotals.Add(new XElement(Cac + "TaxSubtotal",
                new XElement(Cbc + "TaxableAmount",
                    new XAttribute("currencyID", currencyCode),
                    FormatDecimal(group.TaxableAmount)),
                new XElement(Cbc + "TaxAmount",
                    new XAttribute("currencyID", currencyCode),
                    FormatDecimal(group.TaxAmount)),
                new XElement(Cac + "TaxCategory",
                    new XElement(Cbc + "ID", categoryCode),
                    new XElement(Cbc + "Percent", FormatDecimal(group.Rate * 100)),
                    new XElement(Cac + "TaxScheme",
                        new XElement(Cbc + "ID", "VAT")))));
        }

        var totalTax = invoice.TotalTax > 0 ? invoice.TotalTax : invoice.TaxAmount;

        return new XElement(Cac + "TaxTotal",
            new XElement(Cbc + "TaxAmount",
                new XAttribute("currencyID", currencyCode),
                FormatDecimal(totalTax)),
            taxSubtotals);
    }

    /// <summary>BG-22: Document level totals</summary>
    private static XElement BuildLegalMonetaryTotal(Invoice invoice, string currencyCode)
    {
        var netAmount = invoice.SubtotalNet > 0 ? invoice.SubtotalNet : invoice.SubTotal;

        return new XElement(Cac + "LegalMonetaryTotal",
            // BT-106: Sum of Invoice line net amount
            new XElement(Cbc + "LineExtensionAmount",
                new XAttribute("currencyID", currencyCode),
                FormatDecimal(netAmount)),
            // BT-109: Invoice total without VAT
            new XElement(Cbc + "TaxExclusiveAmount",
                new XAttribute("currencyID", currencyCode),
                FormatDecimal(netAmount)),
            // BT-112: Invoice total with VAT
            new XElement(Cbc + "TaxInclusiveAmount",
                new XAttribute("currencyID", currencyCode),
                FormatDecimal(invoice.Total)),
            // BT-115: Amount due for payment
            new XElement(Cbc + "PayableAmount",
                new XAttribute("currencyID", currencyCode),
                FormatDecimal(invoice.Total)));
    }

    /// <summary>BG-25: Invoice lines</summary>
    private List<XElement> BuildInvoiceLines(Invoice invoice, IReadOnlyList<TaxCode> taxCodes, string currencyCode)
    {
        var lines = new List<XElement>();
        var lineNumber = 1;

        foreach (var item in invoice.Items)
        {
            var rate = item.TaxRate ?? 0m;
            var taxCode = item.TaxCodeId.HasValue
                ? taxCodes.FirstOrDefault(tc => tc.Id == item.TaxCodeId.Value)
                : null;
            var categoryCode = DetermineVatCategoryCode(rate, taxCode);

            var lineNetAmount = item.NetAmount ?? item.Amount;

            lines.Add(new XElement(Cac + "InvoiceLine",
                // BT-126: Invoice line identifier
                new XElement(Cbc + "ID", lineNumber.ToString()),

                // BT-129: Invoiced quantity
                new XElement(Cbc + "InvoicedQuantity",
                    new XAttribute("unitCode", "C62"), // C62 = "one" (generic unit)
                    FormatDecimal(item.Quantity)),

                // BT-131: Invoice line net amount
                new XElement(Cbc + "LineExtensionAmount",
                    new XAttribute("currencyID", currencyCode),
                    FormatDecimal(lineNetAmount)),

                // BG-30: Line VAT information
                new XElement(Cac + "Item",
                    // BT-153: Item name
                    new XElement(Cbc + "Name", item.Description),
                    // BG-31: Item classification
                    new XElement(Cac + "ClassifiedTaxCategory",
                        new XElement(Cbc + "ID", categoryCode),
                        new XElement(Cbc + "Percent", FormatDecimal(rate * 100)),
                        new XElement(Cac + "TaxScheme",
                            new XElement(Cbc + "ID", "VAT")))),

                // BG-29: Price details
                new XElement(Cac + "Price",
                    new XElement(Cbc + "PriceAmount",
                        new XAttribute("currencyID", currencyCode),
                        FormatDecimal(item.UnitPrice)))));

            lineNumber++;
        }

        return lines;
    }

    /// <summary>
    /// Determines the EN 16931 VAT category code based on rate and tax code.
    /// S = Standard rate, Z = Zero rated, E = Exempt, AE = Reverse charge
    /// </summary>
    public static string DetermineVatCategoryCode(decimal rate, TaxCode? taxCode)
    {
        // Check tax code label/code for special categories
        if (taxCode is not null)
        {
            var code = taxCode.Code.ToUpperInvariant();
            if (code.Contains("EXEMPT") || code.Contains("BEFREIT"))
                return "E";
            if (code.Contains("REVERSE") || code.Contains("RC"))
                return "AE";
            if (code.Contains("ZERO") || code == "Z")
                return "Z";
        }

        return rate > 0 ? "S" : "Z";
    }

    private static string FormatDecimal(decimal value) =>
        value.ToString("F2", CultureInfo.InvariantCulture);
}
