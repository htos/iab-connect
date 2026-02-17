using System.Xml.Linq;
using FluentAssertions;
using IabConnect.Application.Finance.Invoices;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Finance;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Finance;

/// <summary>
/// REQ-065: Unit tests for UblInvoiceExporter (EN 16931 UBL 2.1 XML generation).
/// </summary>
public class UblInvoiceExporterTests
{
    private static readonly XNamespace Cbc = "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2";
    private static readonly XNamespace Cac = "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2";
    private static readonly XNamespace Inv = "urn:oasis:names:specification:ubl:schema:xsd:Invoice-2";

    private readonly UblInvoiceExporter _sut = new();

    #region Test Helpers

    private static Invoice CreateTestInvoice(
        string invoiceNumber = "INV-2026-001",
        string recipientName = "Max Mustermann",
        string? recipientAddress = "Teststrasse 1, 3000 Bern",
        string? notes = null,
        string? paymentTerms = null,
        decimal taxRate = 7.7m,
        bool markAsSent = true)
    {
        var invoice = Invoice.Create(
            invoiceNumber,
            new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc),
            RecipientType.Member,
            Guid.NewGuid(),
            recipientName,
            recipientAddress,
            taxRate,
            notes,
            "test-user",
            paymentTerms);

        // Add items with tax
        var taxCodeId = Guid.NewGuid();
        invoice.AddItemWithTax("Mitgliedsbeitrag 2026", 1, 100m, taxCodeId, 0.077m, false);
        invoice.AddItemWithTax("Veranstaltung XY", 2, 50m, taxCodeId, 0.077m, false);

        if (markAsSent)
        {
            invoice.MarkAsSent("test-user");
        }

        return invoice;
    }

    private static FinanceProfile CreateTestProfile(
        VatStatus vatStatus = VatStatus.Registered,
        string? vatNumber = "CHE-123.456.789",
        FinanceCurrency currency = FinanceCurrency.CHF,
        string? bankIban = "CH9300762011623852957",
        string? bankBic = "POFICHBEXXX",
        string? bankName = "PostFinance")
    {
        return FinanceProfile.Create(
            Jurisdiction.EU,
            "CH",
            currency,
            1,
            "Indisch-Asiatischer Bildungsverein",
            "Musterstrasse 1",
            "Zürich",
            "8000",
            "CH",
            "info@iab-connect.ch",
            "+41 44 123 45 67",
            "https://iab-connect.ch",
            "CHE-123.456.789 MWST",
            bankName,
            bankIban,
            bankBic,
            vatStatus,
            vatNumber);
    }

    private static List<TaxCode> CreateTestTaxCodes()
    {
        var standard = TaxCode.Create("STANDARD", "Normalsatz 7.7%", 0.077m, true);
        var reduced = TaxCode.Create("REDUCED", "Reduzierter Satz 2.5%", 0.025m);
        var zero = TaxCode.Create("ZERO", "Befreit 0%", 0m);
        return [standard, reduced, zero];
    }

    private async Task<XDocument> ExportAndParseAsync(Invoice? invoice = null, FinanceProfile? profile = null, List<TaxCode>? taxCodes = null)
    {
        invoice ??= CreateTestInvoice();
        profile ??= CreateTestProfile();
        taxCodes ??= CreateTestTaxCodes();

        var bytes = await _sut.ExportAsync(invoice, profile, taxCodes, TestContext.Current.CancellationToken);
        using var ms = new MemoryStream(bytes);
        return XDocument.Load(ms);
    }

    #endregion

    [Fact]
    public async Task Should_Generate_Valid_Xml_Document()
    {
        var doc = await ExportAndParseAsync();

        doc.Should().NotBeNull();
        doc.Root.Should().NotBeNull();
        doc.Root!.Name.Should().Be(Inv + "Invoice");
    }

    [Fact]
    public async Task Should_Return_Non_Empty_Bytes()
    {
        var invoice = CreateTestInvoice();
        var profile = CreateTestProfile();
        var taxCodes = CreateTestTaxCodes();

        var bytes = await _sut.ExportAsync(invoice, profile, taxCodes, TestContext.Current.CancellationToken);

        bytes.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Should_Include_Invoice_Number_BT1()
    {
        var invoice = CreateTestInvoice(invoiceNumber: "INV-2026-042");
        var doc = await ExportAndParseAsync(invoice);

        var id = doc.Root!.Element(Cbc + "ID");
        id.Should().NotBeNull();
        id!.Value.Should().Be("INV-2026-042");
    }

    [Fact]
    public async Task Should_Include_Issue_Date_BT2()
    {
        var doc = await ExportAndParseAsync();

        var issueDate = doc.Root!.Element(Cbc + "IssueDate");
        issueDate.Should().NotBeNull();
        issueDate!.Value.Should().Be("2026-02-01");
    }

    [Fact]
    public async Task Should_Include_Due_Date_BT9()
    {
        var doc = await ExportAndParseAsync();

        var dueDate = doc.Root!.Element(Cbc + "DueDate");
        dueDate.Should().NotBeNull();
        dueDate!.Value.Should().Be("2026-03-01");
    }

    [Fact]
    public async Task Should_Include_Invoice_Type_Code_380_BT3()
    {
        var doc = await ExportAndParseAsync();

        var typeCode = doc.Root!.Element(Cbc + "InvoiceTypeCode");
        typeCode.Should().NotBeNull();
        typeCode!.Value.Should().Be("380");
    }

    [Fact]
    public async Task Should_Include_Currency_Code_BT5()
    {
        var profile = CreateTestProfile(currency: FinanceCurrency.EUR);
        var doc = await ExportAndParseAsync(profile: profile);

        var currencyCode = doc.Root!.Element(Cbc + "DocumentCurrencyCode");
        currencyCode.Should().NotBeNull();
        currencyCode!.Value.Should().Be("EUR");
    }

    [Fact]
    public async Task Should_Use_CHF_Currency_When_Profile_Is_CHF()
    {
        var profile = CreateTestProfile(currency: FinanceCurrency.CHF);
        var doc = await ExportAndParseAsync(profile: profile);

        var currencyCode = doc.Root!.Element(Cbc + "DocumentCurrencyCode");
        currencyCode!.Value.Should().Be("CHF");
    }

    [Fact]
    public async Task Should_Include_EN16931_CustomizationID()
    {
        var doc = await ExportAndParseAsync();

        var customization = doc.Root!.Element(Cbc + "CustomizationID");
        customization.Should().NotBeNull();
        customization!.Value.Should().Be("urn:cen.eu:en16931:2017");
    }

    [Fact]
    public async Task Should_Include_Seller_Party_Name_BT27()
    {
        var doc = await ExportAndParseAsync();

        var sellerParty = doc.Root!.Element(Cac + "AccountingSupplierParty");
        sellerParty.Should().NotBeNull();

        var partyName = sellerParty!.Element(Cac + "Party")!
            .Element(Cac + "PartyName")!
            .Element(Cbc + "Name");
        partyName.Should().NotBeNull();
        partyName!.Value.Should().Be("Indisch-Asiatischer Bildungsverein");
    }

    [Fact]
    public async Task Should_Include_Seller_Address_BG5()
    {
        var doc = await ExportAndParseAsync();

        var sellerParty = doc.Root!.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
        var address = sellerParty.Element(Cac + "PostalAddress");
        address.Should().NotBeNull();

        address!.Element(Cbc + "StreetName")!.Value.Should().Be("Musterstrasse 1");
        address.Element(Cbc + "CityName")!.Value.Should().Be("Zürich");
        address.Element(Cbc + "PostalZone")!.Value.Should().Be("8000");
        address.Element(Cac + "Country")!.Element(Cbc + "IdentificationCode")!.Value.Should().Be("CH");
    }

    [Fact]
    public async Task Should_Include_Seller_Vat_Number_When_Registered_BT31()
    {
        var profile = CreateTestProfile(vatStatus: VatStatus.Registered, vatNumber: "CHE-123.456.789");
        var doc = await ExportAndParseAsync(profile: profile);

        var sellerParty = doc.Root!.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
        var taxScheme = sellerParty.Element(Cac + "PartyTaxScheme");
        taxScheme.Should().NotBeNull();
        taxScheme!.Element(Cbc + "CompanyID")!.Value.Should().Be("CHE-123.456.789");
    }

    [Fact]
    public async Task Should_Not_Include_Vat_Number_When_Not_Registered()
    {
        var profile = CreateTestProfile(vatStatus: VatStatus.NotRegistered, vatNumber: null);
        var doc = await ExportAndParseAsync(profile: profile);

        var sellerParty = doc.Root!.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
        var taxScheme = sellerParty.Element(Cac + "PartyTaxScheme");
        taxScheme.Should().BeNull();
    }

    [Fact]
    public async Task Should_Include_Buyer_Party_Name_BG7()
    {
        var invoice = CreateTestInvoice(recipientName: "Anna Muster");
        var doc = await ExportAndParseAsync(invoice);

        var buyerParty = doc.Root!.Element(Cac + "AccountingCustomerParty")!.Element(Cac + "Party")!;
        var name = buyerParty.Element(Cac + "PartyName")!.Element(Cbc + "Name");
        name!.Value.Should().Be("Anna Muster");
    }

    [Fact]
    public async Task Should_Include_Payment_Means_With_Iban_BG16()
    {
        var profile = CreateTestProfile(bankIban: "CH9300762011623852957", bankBic: "POFICHBEXXX", bankName: "PostFinance");
        var doc = await ExportAndParseAsync(profile: profile);

        var paymentMeans = doc.Root!.Element(Cac + "PaymentMeans");
        paymentMeans.Should().NotBeNull();

        // SEPA code
        paymentMeans!.Element(Cbc + "PaymentMeansCode")!.Value.Should().Be("58");

        var account = paymentMeans.Element(Cac + "PayeeFinancialAccount");
        account.Should().NotBeNull();
        account!.Element(Cbc + "ID")!.Value.Should().Be("CH9300762011623852957");
        account.Element(Cbc + "Name")!.Value.Should().Be("PostFinance");
        account.Element(Cac + "FinancialInstitutionBranch")!.Element(Cbc + "ID")!.Value.Should().Be("POFICHBEXXX");
    }

    [Fact]
    public async Task Should_Use_Code_30_When_No_Iban()
    {
        var profile = CreateTestProfile(bankIban: null, bankBic: null, bankName: null);
        var doc = await ExportAndParseAsync(profile: profile);

        var paymentMeans = doc.Root!.Element(Cac + "PaymentMeans");
        paymentMeans!.Element(Cbc + "PaymentMeansCode")!.Value.Should().Be("30");
    }

    [Fact]
    public async Task Should_Include_Tax_Total_And_Subtotals_BG23()
    {
        var doc = await ExportAndParseAsync();

        var taxTotal = doc.Root!.Element(Cac + "TaxTotal");
        taxTotal.Should().NotBeNull();

        var totalTaxAmount = taxTotal!.Element(Cbc + "TaxAmount");
        totalTaxAmount.Should().NotBeNull();

        var subtotals = taxTotal.Elements(Cac + "TaxSubtotal").ToList();
        subtotals.Should().NotBeEmpty();

        // Each subtotal should have TaxableAmount, TaxAmount, TaxCategory
        foreach (var sub in subtotals)
        {
            sub.Element(Cbc + "TaxableAmount").Should().NotBeNull();
            sub.Element(Cbc + "TaxAmount").Should().NotBeNull();
            sub.Element(Cac + "TaxCategory").Should().NotBeNull();
            sub.Element(Cac + "TaxCategory")!.Element(Cbc + "ID").Should().NotBeNull();
            sub.Element(Cac + "TaxCategory")!.Element(Cbc + "Percent").Should().NotBeNull();
        }
    }

    [Fact]
    public async Task Should_Include_Legal_Monetary_Total_BG22()
    {
        var doc = await ExportAndParseAsync();

        var lmt = doc.Root!.Element(Cac + "LegalMonetaryTotal");
        lmt.Should().NotBeNull();

        lmt!.Element(Cbc + "LineExtensionAmount").Should().NotBeNull();
        lmt.Element(Cbc + "TaxExclusiveAmount").Should().NotBeNull();
        lmt.Element(Cbc + "TaxInclusiveAmount").Should().NotBeNull();
        lmt.Element(Cbc + "PayableAmount").Should().NotBeNull();
    }

    [Fact]
    public async Task Should_Include_Invoice_Lines_With_Items_BG25()
    {
        var doc = await ExportAndParseAsync();

        var lines = doc.Root!.Elements(Cac + "InvoiceLine").ToList();
        lines.Should().HaveCount(2);

        var firstLine = lines[0];
        firstLine.Element(Cbc + "ID")!.Value.Should().Be("1");
        firstLine.Element(Cbc + "InvoicedQuantity").Should().NotBeNull();
        firstLine.Element(Cbc + "LineExtensionAmount").Should().NotBeNull();

        var item = firstLine.Element(Cac + "Item");
        item.Should().NotBeNull();
        item!.Element(Cbc + "Name")!.Value.Should().Be("Mitgliedsbeitrag 2026");

        var price = firstLine.Element(Cac + "Price");
        price.Should().NotBeNull();
        price!.Element(Cbc + "PriceAmount").Should().NotBeNull();
    }

    [Fact]
    public async Task Should_Have_Consistent_Tax_Totals()
    {
        var doc = await ExportAndParseAsync();

        var taxTotal = doc.Root!.Element(Cac + "TaxTotal")!;
        var totalTax = decimal.Parse(taxTotal.Element(Cbc + "TaxAmount")!.Value,
            System.Globalization.CultureInfo.InvariantCulture);

        var subtotalTaxes = taxTotal.Elements(Cac + "TaxSubtotal")
            .Select(s => decimal.Parse(s.Element(Cbc + "TaxAmount")!.Value,
                System.Globalization.CultureInfo.InvariantCulture))
            .Sum();

        // Total tax should equal sum of subtotals (or be very close due to rounding)
        totalTax.Should().BeApproximately(subtotalTaxes, 0.02m);
    }

    [Fact]
    public void Should_Use_Correct_Vat_Category_S_For_Standard_Rate()
    {
        var result = UblInvoiceExporter.DetermineVatCategoryCode(0.077m, null);
        result.Should().Be("S");
    }

    [Fact]
    public void Should_Use_Correct_Vat_Category_Z_For_Zero_Rate()
    {
        var result = UblInvoiceExporter.DetermineVatCategoryCode(0m, null);
        result.Should().Be("Z");
    }

    [Fact]
    public void Should_Use_Vat_Category_E_For_Exempt_TaxCode()
    {
        var taxCode = TaxCode.Create("EXEMPT", "Befreit", 0m);
        var result = UblInvoiceExporter.DetermineVatCategoryCode(0m, taxCode);
        result.Should().Be("E");
    }

    [Fact]
    public void Should_Use_Vat_Category_AE_For_Reverse_Charge_TaxCode()
    {
        var taxCode = TaxCode.Create("RC", "Reverse Charge", 0m);
        var result = UblInvoiceExporter.DetermineVatCategoryCode(0m, taxCode);
        result.Should().Be("AE");
    }

    [Fact]
    public async Task Should_Include_Notes_When_Present()
    {
        var invoice = CreateTestInvoice(notes: "Some important note about this invoice");
        var doc = await ExportAndParseAsync(invoice);

        var note = doc.Root!.Element(Cbc + "Note");
        note.Should().NotBeNull();
        note!.Value.Should().Be("Some important note about this invoice");
    }

    [Fact]
    public async Task Should_Not_Include_Notes_When_Absent()
    {
        var invoice = CreateTestInvoice(notes: null);
        var doc = await ExportAndParseAsync(invoice);

        var note = doc.Root!.Element(Cbc + "Note");
        note.Should().BeNull();
    }

    [Fact]
    public async Task Should_Include_Payment_Terms_When_Present()
    {
        var invoice = CreateTestInvoice(paymentTerms: "Net 30 days");
        var doc = await ExportAndParseAsync(invoice);

        var paymentTerms = doc.Root!.Element(Cac + "PaymentTerms");
        paymentTerms.Should().NotBeNull();
        paymentTerms!.Element(Cbc + "Note")!.Value.Should().Be("Net 30 days");
    }

    [Fact]
    public async Task Should_Not_Include_Payment_Terms_When_Absent()
    {
        var invoice = CreateTestInvoice(paymentTerms: null);
        var doc = await ExportAndParseAsync(invoice);

        var paymentTerms = doc.Root!.Element(Cac + "PaymentTerms");
        paymentTerms.Should().BeNull();
    }

    [Fact]
    public async Task Should_Include_CurrencyID_Attributes_On_Amounts()
    {
        var profile = CreateTestProfile(currency: FinanceCurrency.EUR);
        var doc = await ExportAndParseAsync(profile: profile);

        var lmt = doc.Root!.Element(Cac + "LegalMonetaryTotal")!;
        lmt.Element(Cbc + "PayableAmount")!.Attribute("currencyID")!.Value.Should().Be("EUR");

        var taxTotal = doc.Root!.Element(Cac + "TaxTotal")!;
        taxTotal.Element(Cbc + "TaxAmount")!.Attribute("currencyID")!.Value.Should().Be("EUR");
    }

    [Fact]
    public void Should_Report_Format_As_UBL()
    {
        _sut.Format.Should().Be(EInvoiceFormat.UBL);
    }

    [Fact]
    public async Task Should_Include_Seller_Email_As_Contact()
    {
        var doc = await ExportAndParseAsync();

        var sellerParty = doc.Root!.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
        var contact = sellerParty.Element(Cac + "Contact");
        contact.Should().NotBeNull();
        contact!.Element(Cbc + "ElectronicMail")!.Value.Should().Be("info@iab-connect.ch");
    }

    [Fact]
    public async Task Should_Include_Seller_UID_As_CompanyID()
    {
        var doc = await ExportAndParseAsync();

        var sellerParty = doc.Root!.Element(Cac + "AccountingSupplierParty")!.Element(Cac + "Party")!;
        var legalEntity = sellerParty.Element(Cac + "PartyLegalEntity");
        legalEntity.Should().NotBeNull();
        legalEntity!.Element(Cbc + "CompanyID")!.Value.Should().Be("CHE-123.456.789 MWST");
    }

    [Fact]
    public async Task Should_Include_Invoice_Number_As_PaymentID()
    {
        var invoice = CreateTestInvoice(invoiceNumber: "INV-2026-099");
        var doc = await ExportAndParseAsync(invoice);

        var paymentMeans = doc.Root!.Element(Cac + "PaymentMeans");
        paymentMeans!.Element(Cbc + "PaymentID")!.Value.Should().Be("INV-2026-099");
    }
}
