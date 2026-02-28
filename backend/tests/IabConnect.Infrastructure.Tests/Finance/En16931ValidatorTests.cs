using System.Xml.Linq;
using FluentAssertions;
using IabConnect.Application.Finance.EInvoice;
using IabConnect.Infrastructure.Finance.EInvoice;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Finance;

/// <summary>
/// REQ-072: Unit tests for En16931Validator (EN 16931 eInvoice business-rule validation).
/// </summary>
public class En16931ValidatorTests
{
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Inv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";

    private readonly En16931Validator _sut = new(Array.Empty<ICiusProfile>());

    #region Test Helpers

    /// <summary>
    /// Builds a valid EN 16931 UBL 2.1 invoice XML string.
    /// All mandatory BT/BG fields are present with consistent calculations.
    /// </summary>
    private static string BuildValidInvoiceXml(Action<XElement>? customize = null)
    {
        var root = new XElement(Inv + "Invoice",
            new XAttribute(XNamespace.Xmlns + "cbc", Cbc.NamespaceName),
            new XAttribute(XNamespace.Xmlns + "cac", Cac.NamespaceName),

            // BT-24: Specification identifier
            new XElement(Cbc + "CustomizationID", "urn:cen.eu:en16931:2017"),
            // BT-23: Business process type
            new XElement(Cbc + "ProfileID", "urn:fdc:peppol.eu:2017:poacc:billing:01:1.0"),
            // BT-1: Invoice number
            new XElement(Cbc + "ID", "INV-2026-001"),
            // BT-2: Issue date
            new XElement(Cbc + "IssueDate", "2026-02-01"),
            // BT-9: Due date
            new XElement(Cbc + "DueDate", "2026-03-01"),
            // BT-3: Invoice type code
            new XElement(Cbc + "InvoiceTypeCode", "380"),
            // BT-5: Currency
            new XElement(Cbc + "DocumentCurrencyCode", "CHF"),

            // BG-4: Seller
            new XElement(Cac + "AccountingSupplierParty",
                new XElement(Cac + "Party",
                    new XElement(Cac + "PartyName",
                        new XElement(Cbc + "Name", "Test Seller GmbH")),
                    new XElement(Cac + "PostalAddress",
                        new XElement(Cbc + "StreetName", "Musterstrasse 1"),
                        new XElement(Cbc + "CityName", "Zürich"),
                        new XElement(Cbc + "PostalZone", "8000"),
                        new XElement(Cac + "Country",
                            new XElement(Cbc + "IdentificationCode", "CH"))),
                    new XElement(Cac + "PartyLegalEntity",
                        new XElement(Cbc + "RegistrationName", "Test Seller GmbH")))),

            // BG-7: Buyer
            new XElement(Cac + "AccountingCustomerParty",
                new XElement(Cac + "Party",
                    new XElement(Cac + "PartyName",
                        new XElement(Cbc + "Name", "Test Buyer AG")),
                    new XElement(Cac + "PostalAddress",
                        new XElement(Cbc + "StreetName", "Käuferweg 5"),
                        new XElement(Cbc + "CityName", "Bern"),
                        new XElement(Cbc + "PostalZone", "3000"),
                        new XElement(Cac + "Country",
                            new XElement(Cbc + "IdentificationCode", "CH"))),
                    new XElement(Cac + "PartyLegalEntity",
                        new XElement(Cbc + "RegistrationName", "Test Buyer AG")))),

            // BG-16: Payment means
            new XElement(Cac + "PaymentMeans",
                new XElement(Cbc + "PaymentMeansCode", "58"),
                new XElement(Cbc + "PaymentID", "INV-2026-001")),

            // BT-20: Payment terms
            new XElement(Cac + "PaymentTerms",
                new XElement(Cbc + "Note", "Net 30 days")),

            // BG-23: Tax total (7.7% on 200.00 = 15.40)
            new XElement(Cac + "TaxTotal",
                new XElement(Cbc + "TaxAmount",
                    new XAttribute("currencyID", "CHF"), "15.40"),
                new XElement(Cac + "TaxSubtotal",
                    new XElement(Cbc + "TaxableAmount",
                        new XAttribute("currencyID", "CHF"), "200.00"),
                    new XElement(Cbc + "TaxAmount",
                        new XAttribute("currencyID", "CHF"), "15.40"),
                    new XElement(Cac + "TaxCategory",
                        new XElement(Cbc + "ID", "S"),
                        new XElement(Cbc + "Percent", "7.70"),
                        new XElement(Cac + "TaxScheme",
                            new XElement(Cbc + "ID", "VAT"))))),

            // BG-22: Legal monetary total
            new XElement(Cac + "LegalMonetaryTotal",
                new XElement(Cbc + "LineExtensionAmount",
                    new XAttribute("currencyID", "CHF"), "200.00"),
                new XElement(Cbc + "TaxExclusiveAmount",
                    new XAttribute("currencyID", "CHF"), "200.00"),
                new XElement(Cbc + "TaxInclusiveAmount",
                    new XAttribute("currencyID", "CHF"), "215.40"),
                new XElement(Cbc + "PayableAmount",
                    new XAttribute("currencyID", "CHF"), "215.40")),

            // BG-25: Invoice lines (2 lines totalling 200.00)
            new XElement(Cac + "InvoiceLine",
                new XElement(Cbc + "ID", "1"),
                new XElement(Cbc + "InvoicedQuantity",
                    new XAttribute("unitCode", "C62"), "1.00"),
                new XElement(Cbc + "LineExtensionAmount",
                    new XAttribute("currencyID", "CHF"), "100.00"),
                new XElement(Cac + "Item",
                    new XElement(Cbc + "Name", "Mitgliedsbeitrag 2026"),
                    new XElement(Cac + "ClassifiedTaxCategory",
                        new XElement(Cbc + "ID", "S"),
                        new XElement(Cbc + "Percent", "7.70"),
                        new XElement(Cac + "TaxScheme",
                            new XElement(Cbc + "ID", "VAT")))),
                new XElement(Cac + "Price",
                    new XElement(Cbc + "PriceAmount",
                        new XAttribute("currencyID", "CHF"), "100.00"))),

            new XElement(Cac + "InvoiceLine",
                new XElement(Cbc + "ID", "2"),
                new XElement(Cbc + "InvoicedQuantity",
                    new XAttribute("unitCode", "C62"), "2.00"),
                new XElement(Cbc + "LineExtensionAmount",
                    new XAttribute("currencyID", "CHF"), "100.00"),
                new XElement(Cac + "Item",
                    new XElement(Cbc + "Name", "Veranstaltung XY"),
                    new XElement(Cac + "ClassifiedTaxCategory",
                        new XElement(Cbc + "ID", "S"),
                        new XElement(Cbc + "Percent", "7.70"),
                        new XElement(Cac + "TaxScheme",
                            new XElement(Cbc + "ID", "VAT")))),
                new XElement(Cac + "Price",
                    new XElement(Cbc + "PriceAmount",
                        new XAttribute("currencyID", "CHF"), "50.00"))));

        customize?.Invoke(root);

        var doc = new XDocument(new XDeclaration("1.0", "UTF-8", null), root);
        return doc.ToString();
    }

    /// <summary>
    /// Helper to remove an element by name from the root (or nested).
    /// </summary>
    private static void RemoveElement(XElement root, XName name)
    {
        root.Descendants(name).Remove();
    }

    #endregion

    #region Valid Invoice — No Errors

    [Fact]
    public async Task ValidInvoice_Should_Have_No_Errors()
    {
        var xml = BuildValidInvoiceXml();

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public async Task ValidInvoice_Should_Have_No_Warnings_When_All_Recommended_Fields_Present()
    {
        var xml = BuildValidInvoiceXml();

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Warnings.Should().BeEmpty();
    }

    #endregion

    #region XML Parse Errors

    [Fact]
    public async Task InvalidXml_Should_Return_Fatal_ParseError()
    {
        var result = await _sut.ValidateAsync("<not valid xml>><", TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.RuleId == "XML-PARSE" && e.Severity == "Fatal");
    }

    [Fact]
    public async Task WrongRootElement_Should_Return_Fatal_Error()
    {
        var xml = "<CreditNote xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:CreditNote-2\"><ID>1</ID></CreditNote>";

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().ContainSingle(e => e.RuleId == "XML-ROOT" && e.Severity == "Fatal");
    }

    #endregion

    #region BR-01: Specification Identifier (BT-24)

    [Fact]
    public async Task Missing_CustomizationID_Should_Return_BR01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            RemoveElement(root, Cbc + "CustomizationID"));

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-01" && e.Field == "BT-24");
    }

    #endregion

    #region BR-02: Invoice Number (BT-1)

    [Fact]
    public async Task Missing_InvoiceNumber_Should_Return_BR02_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            RemoveElement(root, Cbc + "ID"));

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-02" && e.Field == "BT-1");
    }

    [Fact]
    public async Task Empty_InvoiceNumber_Should_Return_BR02_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cbc + "ID")!.Value = "");

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-02");
    }

    #endregion

    #region BR-03: Issue Date (BT-2)

    [Fact]
    public async Task Missing_IssueDate_Should_Return_BR03_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            RemoveElement(root, Cbc + "IssueDate"));

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-03" && e.Field == "BT-2");
    }

    #endregion

    #region BR-04: Invoice Type Code (BT-3)

    [Fact]
    public async Task Missing_InvoiceTypeCode_Should_Return_BR04_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            RemoveElement(root, Cbc + "InvoiceTypeCode"));

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-04" && e.Field == "BT-3");
    }

    #endregion

    #region BR-05: Currency Code (BT-5)

    [Fact]
    public async Task Missing_CurrencyCode_Should_Return_BR05_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            RemoveElement(root, Cbc + "DocumentCurrencyCode"));

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-05" && e.Field == "BT-5");
    }

    #endregion

    #region BR-06: Seller Name (BT-27)

    [Fact]
    public async Task Missing_Seller_Should_Return_BR06_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cac + "AccountingSupplierParty")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-06" && e.Field == "BT-27");
    }

    [Fact]
    public async Task Missing_SellerName_Should_Return_BR06_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var party = root.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
            party.Element(Cac + "PartyName")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-06" && e.Field == "BT-27");
    }

    #endregion

    #region BR-07: Buyer Name (BT-44)

    [Fact]
    public async Task Missing_Buyer_Should_Return_BR07_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cac + "AccountingCustomerParty")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-07" && e.Field == "BT-44");
    }

    [Fact]
    public async Task Missing_BuyerName_Should_Return_BR07_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var party = root.Element(Cac + "AccountingCustomerParty")!.Element(Cac + "Party")!;
            party.Element(Cac + "PartyName")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-07" && e.Field == "BT-44");
    }

    #endregion

    #region BR-08/09: Seller Address & Country

    [Fact]
    public async Task Missing_SellerPostalAddress_Should_Return_BR08_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var party = root.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
            party.Element(Cac + "PostalAddress")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-08" && e.Field == "BG-5");
    }

    [Fact]
    public async Task Missing_SellerCountry_Should_Return_BR09_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var address = root.Element(Cac + "AccountingSupplierParty")!
                .Element(Cac + "Party")!
                .Element(Cac + "PostalAddress")!;
            address.Element(Cac + "Country")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-09" && e.Field == "BT-40");
    }

    #endregion

    #region BR-10/11: Buyer Address & Country

    [Fact]
    public async Task Missing_BuyerPostalAddress_Should_Return_BR10_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var party = root.Element(Cac + "AccountingCustomerParty")!.Element(Cac + "Party")!;
            party.Element(Cac + "PostalAddress")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-10" && e.Field == "BG-8");
    }

    [Fact]
    public async Task Missing_BuyerCountry_Should_Return_BR11_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var address = root.Element(Cac + "AccountingCustomerParty")!
                .Element(Cac + "Party")!
                .Element(Cac + "PostalAddress")!;
            address.Element(Cac + "Country")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-11" && e.Field == "BT-55");
    }

    #endregion

    #region BR-13: Invoice Lines

    [Fact]
    public async Task No_InvoiceLines_Should_Return_BR13_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            root.Elements(Cac + "InvoiceLine").Remove();
            // Fix totals to 0 so calculation checks don't fire
            var lmt = root.Element(Cac + "LegalMonetaryTotal")!;
            lmt.Element(Cbc + "LineExtensionAmount")!.Value = "0.00";
            lmt.Element(Cbc + "TaxExclusiveAmount")!.Value = "0.00";
            lmt.Element(Cbc + "TaxInclusiveAmount")!.Value = "0.00";
            lmt.Element(Cbc + "PayableAmount")!.Value = "0.00";
            var taxTotal = root.Element(Cac + "TaxTotal")!;
            taxTotal.Element(Cbc + "TaxAmount")!.Value = "0.00";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-13" && e.Field == "BG-25");
    }

    #endregion

    #region BR-14: Invoice Line Identifier

    [Fact]
    public async Task Missing_LineId_Should_Return_BR14_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            // Remove the ID from the first InvoiceLine
            var firstLine = root.Elements(Cac + "InvoiceLine").First();
            firstLine.Element(Cbc + "ID")!.Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-14" && e.Field == "BT-126");
    }

    #endregion

    #region BR-16: Tax Breakdown

    [Fact]
    public async Task Missing_TaxTotal_Should_Return_BR16_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cac + "TaxTotal")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-16" && e.Field == "BG-23");
    }

    [Fact]
    public async Task TaxTotal_Without_Subtotals_Should_Return_BR16_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var taxTotal = root.Element(Cac + "TaxTotal")!;
            taxTotal.Elements(Cac + "TaxSubtotal").Remove();
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-16" && e.Field == "BG-23");
    }

    #endregion

    #region BR-CO-10: Line Amount Sum

    [Fact]
    public async Task LineAmountSum_Mismatch_Should_Return_BRCO10_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            // Set LineExtensionAmount to wrong value
            var lmt = root.Element(Cac + "LegalMonetaryTotal")!;
            lmt.Element(Cbc + "LineExtensionAmount")!.Value = "999.99";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-CO-10" && e.Field == "BT-106");
    }

    #endregion

    #region BR-CO-15: Total With VAT Calculation

    [Fact]
    public async Task TotalWithVat_Mismatch_Should_Return_BRCO15_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            // Set TaxInclusiveAmount to wrong value
            var lmt = root.Element(Cac + "LegalMonetaryTotal")!;
            lmt.Element(Cbc + "TaxInclusiveAmount")!.Value = "999.99";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-CO-15" && e.Field == "BT-112");
    }

    #endregion

    #region BR-S-01: Standard Rate

    [Fact]
    public async Task StandardRate_ZeroTaxableAmount_Should_Return_BRS01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var subtotal = root.Element(Cac + "TaxTotal")!.Element(Cac + "TaxSubtotal")!;
            subtotal.Element(Cbc + "TaxableAmount")!.Value = "0.00";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-S-01");
    }

    #endregion

    #region BR-Z-01: Zero-Rated

    [Fact]
    public async Task ZeroRated_WithNonZeroRate_Should_Return_BRZ01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var category = root.Element(Cac + "TaxTotal")!
                .Element(Cac + "TaxSubtotal")!
                .Element(Cac + "TaxCategory")!;
            category.Element(Cbc + "ID")!.Value = "Z";
            category.Element(Cbc + "Percent")!.Value = "7.70";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-Z-01");
    }

    [Fact]
    public async Task ZeroRated_WithZeroRate_Should_Not_Return_BRZ01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var category = root.Element(Cac + "TaxTotal")!
                .Element(Cac + "TaxSubtotal")!
                .Element(Cac + "TaxCategory")!;
            category.Element(Cbc + "ID")!.Value = "Z";
            category.Element(Cbc + "Percent")!.Value = "0.00";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Errors.Should().NotContain(e => e.RuleId == "BR-Z-01");
    }

    #endregion

    #region BR-E-01: Exempt

    [Fact]
    public async Task Exempt_WithNonZeroRate_Should_Return_BRE01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var category = root.Element(Cac + "TaxTotal")!
                .Element(Cac + "TaxSubtotal")!
                .Element(Cac + "TaxCategory")!;
            category.Element(Cbc + "ID")!.Value = "E";
            category.Element(Cbc + "Percent")!.Value = "5.00";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-E-01");
    }

    #endregion

    #region BR-AE-01: Reverse Charge

    [Fact]
    public async Task ReverseCharge_WithNonZeroRate_Should_Return_BRAE01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var category = root.Element(Cac + "TaxTotal")!
                .Element(Cac + "TaxSubtotal")!
                .Element(Cac + "TaxCategory")!;
            category.Element(Cbc + "ID")!.Value = "AE";
            category.Element(Cbc + "Percent")!.Value = "19.00";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "BR-AE-01");
    }

    [Fact]
    public async Task ReverseCharge_WithZeroRate_Should_Not_Return_BRAE01_Error()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            var category = root.Element(Cac + "TaxTotal")!
                .Element(Cac + "TaxSubtotal")!
                .Element(Cac + "TaxCategory")!;
            category.Element(Cbc + "ID")!.Value = "AE";
            category.Element(Cbc + "Percent")!.Value = "0.00";
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Errors.Should().NotContain(e => e.RuleId == "BR-AE-01");
    }

    #endregion

    #region Warnings

    [Fact]
    public async Task Missing_PaymentTerms_Should_Return_Warning()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cac + "PaymentTerms")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Warnings.Should().Contain(w => w.RuleId == "W-BT-20" && w.Field == "BT-20");
    }

    [Fact]
    public async Task Missing_DueDate_Should_Return_Warning()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cbc + "DueDate")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Warnings.Should().Contain(w => w.RuleId == "W-BT-9" && w.Field == "BT-9");
    }

    [Fact]
    public async Task Missing_PaymentMeans_Should_Return_Warning()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cac + "PaymentMeans")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Warnings.Should().Contain(w => w.RuleId == "W-BG-16" && w.Field == "BG-16");
    }

    [Fact]
    public async Task ValidInvoice_With_Warnings_Should_Still_Be_Valid()
    {
        var xml = BuildValidInvoiceXml(root =>
            root.Element(Cac + "PaymentTerms")!.Remove());

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        // Has warnings but no errors — IsValid should be true
        result.IsValid.Should().BeTrue();
        result.Warnings.Should().NotBeEmpty();
    }

    #endregion

    #region CIUS Extension Point

    [Fact]
    public async Task Should_Invoke_Registered_CiusProfiles()
    {
        var mockProfile = new TestCiusProfile(
            "test-profile",
            "Test CIUS",
            new EInvoiceValidationResult
            {
                Errors = [new EInvoiceValidationError
                {
                    RuleId = "CIUS-TEST-01",
                    Field = "BT-99",
                    Message = "Test CIUS error"
                }]
            });

        var validator = new En16931Validator([mockProfile]);
        var xml = BuildValidInvoiceXml();

        var result = await validator.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.RuleId == "CIUS-TEST-01");
    }

    [Fact]
    public async Task Should_Merge_CiusProfile_Warnings()
    {
        var mockProfile = new TestCiusProfile(
            "test-profile",
            "Test CIUS",
            new EInvoiceValidationResult
            {
                Warnings = [new EInvoiceValidationWarning
                {
                    RuleId = "CIUS-WARN-01",
                    Field = "BT-99",
                    Message = "Test CIUS warning"
                }]
            });

        var validator = new En16931Validator([mockProfile]);
        var xml = BuildValidInvoiceXml();

        var result = await validator.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Warnings.Should().Contain(w => w.RuleId == "CIUS-WARN-01");
    }

    private sealed class TestCiusProfile : ICiusProfile
    {
        private readonly EInvoiceValidationResult _result;

        public TestCiusProfile(string profileId, string description, EInvoiceValidationResult result)
        {
            ProfileId = profileId;
            Description = description;
            _result = result;
        }

        public string ProfileId { get; }
        public string Description { get; }

        public EInvoiceValidationResult Validate(XDocument ublDocument) => _result;
    }

    #endregion

    #region Multiple Errors

    [Fact]
    public async Task Multiple_Missing_Fields_Should_Return_Multiple_Errors()
    {
        var xml = BuildValidInvoiceXml(root =>
        {
            RemoveElement(root, Cbc + "ID");
            RemoveElement(root, Cbc + "IssueDate");
            RemoveElement(root, Cbc + "InvoiceTypeCode");
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().HaveCountGreaterThanOrEqualTo(3);
        result.Errors.Should().Contain(e => e.RuleId == "BR-02");
        result.Errors.Should().Contain(e => e.RuleId == "BR-03");
        result.Errors.Should().Contain(e => e.RuleId == "BR-04");
    }

    #endregion

    #region Calculation Edge Cases

    [Fact]
    public async Task Correct_Calculations_Should_Not_Return_Errors()
    {
        var xml = BuildValidInvoiceXml();

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Errors.Should().NotContain(e => e.RuleId == "BR-CO-10");
        result.Errors.Should().NotContain(e => e.RuleId == "BR-CO-15");
    }

    [Fact]
    public async Task Small_Rounding_Difference_Within_Tolerance_Should_Pass()
    {
        // 0.01 tolerance — set amounts to be within 0.005 of expected
        var xml = BuildValidInvoiceXml(root =>
        {
            var lmt = root.Element(Cac + "LegalMonetaryTotal")!;
            lmt.Element(Cbc + "LineExtensionAmount")!.Value = "200.01"; // Within 0.01 of 200.00
        });

        var result = await _sut.ValidateAsync(xml, TestContext.Current.CancellationToken);

        result.Errors.Should().NotContain(e => e.RuleId == "BR-CO-10");
    }

    #endregion
}
