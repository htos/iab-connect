using System.Xml.Linq;
using FluentAssertions;
using IabConnect.Application.Finance.Exports.Pain001;
using IabConnect.Infrastructure.Finance;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Finance;

/// <summary>
/// REQ-073: Unit tests for Pain001Generator (ISO 20022 pain.001.001.09 XML generation).
/// </summary>
public class Pain001GeneratorTests
{
    private static readonly XNamespace Ns = "urn:iso:std:iso:20022:tech:xsd:pain.001.001.09";

    private readonly Pain001Generator _sut = new();

    #region Test Helpers

    private static Pain001Config CreateChSpsConfig(
        string messageId = "MSG-20260228-ABCD1234",
        string debtorName = "IAB Kulturverein",
        string debtorIban = "CH9300762011623852957",
        string? debtorBic = "POFICHBEXXX",
        string currency = "CHF") =>
        new()
        {
            MessageId = messageId,
            InitiatingPartyName = debtorName,
            DebtorName = debtorName,
            DebtorIban = debtorIban,
            DebtorBic = debtorBic,
            DebtorStreet = "Musterstrasse 1",
            DebtorCity = "Zürich",
            DebtorPostalCode = "8000",
            DebtorCountry = "CH",
            Currency = currency,
            Profile = Pain001Profile.ChSps
        };

    private static Pain001Config CreateSepaConfig(
        string messageId = "MSG-20260228-EFGH5678",
        string debtorName = "IAB Kulturverein",
        string debtorIban = "DE89370400440532013000",
        string? debtorBic = "COBADEFFXXX",
        string currency = "EUR") =>
        new()
        {
            MessageId = messageId,
            InitiatingPartyName = debtorName,
            DebtorName = debtorName,
            DebtorIban = debtorIban,
            DebtorBic = debtorBic,
            DebtorStreet = "Hauptstraße 42",
            DebtorCity = "Berlin",
            DebtorPostalCode = "10115",
            DebtorCountry = "DE",
            Currency = currency,
            Profile = Pain001Profile.Sepa
        };

    private static Pain001PaymentInfo CreatePaymentInfo(
        decimal amount = 1000m,
        string currency = "CHF",
        string creditorName = "Lieferant AG",
        string creditorIban = "CH4431999123000889012",
        string? creditorBic = "UBSWCHZH80A",
        string? remittanceInfo = "Invoice 2026-001",
        string? qrReference = null,
        string? creditorReference = null,
        Guid? paymentId = null) =>
        new()
        {
            PaymentId = paymentId ?? Guid.NewGuid(),
            EndToEndId = $"E2E-{Guid.NewGuid().ToString("N")[..16].ToUpperInvariant()}",
            Amount = amount,
            Currency = currency,
            CreditorName = creditorName,
            CreditorIban = creditorIban,
            CreditorBic = creditorBic,
            CreditorStreet = "Lieferantenweg 5",
            CreditorCity = "Bern",
            CreditorPostalCode = "3000",
            CreditorCountry = "CH",
            RemittanceInfo = remittanceInfo,
            QrReference = qrReference,
            CreditorReference = creditorReference,
            RequestedExecutionDate = new DateTimeOffset(2026, 2, 28, 0, 0, 0, TimeSpan.Zero)
        };

    private static Pain001PaymentInfo CreateSepaPaymentInfo(
        decimal amount = 500m,
        string creditorName = "Euro Supplier GmbH",
        string creditorIban = "DE75512108001245126199",
        string? creditorBic = "SOLADEST600",
        string? creditorReference = "RF18539007547034") =>
        new()
        {
            PaymentId = Guid.NewGuid(),
            EndToEndId = $"E2E-{Guid.NewGuid().ToString("N")[..16].ToUpperInvariant()}",
            Amount = amount,
            Currency = "EUR",
            CreditorName = creditorName,
            CreditorIban = creditorIban,
            CreditorBic = creditorBic,
            CreditorStreet = "Berliner Str. 10",
            CreditorCity = "Stuttgart",
            CreditorPostalCode = "70173",
            CreditorCountry = "DE",
            CreditorReference = creditorReference,
            RequestedExecutionDate = new DateTimeOffset(2026, 2, 28, 0, 0, 0, TimeSpan.Zero)
        };

    #endregion

    #region CH SPS Generation Tests

    [Fact]
    public void Generate_ChSps_SinglePayment_ShouldProduceValidXml()
    {
        // Arrange
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        // Act
        var xml = _sut.Generate(config, payments);

        // Assert
        xml.Should().NotBeNullOrWhiteSpace();
        var doc = XDocument.Parse(xml);
        doc.Root.Should().NotBeNull();
        doc.Root!.Name.Should().Be(Ns + "Document");
    }

    [Fact]
    public void Generate_ChSps_ShouldContainCorrectNamespace()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);

        xml.Should().Contain("urn:iso:std:iso:20022:tech:xsd:pain.001.001.09");
    }

    [Fact]
    public void Generate_ChSps_ShouldHaveCorrectGroupHeader()
    {
        var config = CreateChSpsConfig(messageId: "MSG-TEST-001");
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(amount: 1000m),
            CreatePaymentInfo(amount: 2500m)
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var grpHdr = doc.Descendants(Ns + "GrpHdr").Single();
        grpHdr.Element(Ns + "MsgId")!.Value.Should().Be("MSG-TEST-001");
        grpHdr.Element(Ns + "NbOfTxs")!.Value.Should().Be("2");
        grpHdr.Element(Ns + "CtrlSum")!.Value.Should().Be("3500.00");
        grpHdr.Element(Ns + "InitgPty")!.Element(Ns + "Nm")!.Value.Should().Be("IAB Kulturverein");
    }

    [Fact]
    public void Generate_ChSps_ShouldHaveSdvaServiceLevel()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var svcLvl = doc.Descendants(Ns + "SvcLvl").Single();
        svcLvl.Element(Ns + "Cd")!.Value.Should().Be("SDVA");
    }

    [Fact]
    public void Generate_ChSps_ShouldContainDebtorInfo()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var dbtr = doc.Descendants(Ns + "Dbtr").First();
        dbtr.Element(Ns + "Nm")!.Value.Should().Be("IAB Kulturverein");

        var dbtrIban = doc.Descendants(Ns + "DbtrAcct").Single()
            .Element(Ns + "Id")!.Element(Ns + "IBAN")!.Value;
        dbtrIban.Should().Be("CH9300762011623852957");
    }

    [Fact]
    public void Generate_ChSps_ShouldContainDebtorBic()
    {
        var config = CreateChSpsConfig(debtorBic: "POFICHBEXXX");
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var bicfi = doc.Descendants(Ns + "DbtrAgt").Single()
            .Element(Ns + "FinInstnId")!.Element(Ns + "BICFI")!.Value;
        bicfi.Should().Be("POFICHBEXXX");
    }

    [Fact]
    public void Generate_ChSps_WithQrReference_ShouldUseStructuredRemittance()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(qrReference: "210000000003139471430009017")
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var strd = doc.Descendants(Ns + "Strd").Single();
        strd.Element(Ns + "CdtrRefInf")!.Element(Ns + "Ref")!.Value
            .Should().Be("210000000003139471430009017");
    }

    [Fact]
    public void Generate_ChSps_WithUnstructuredRemittance_ShouldUseUstrd()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(remittanceInfo: "Invoice 2026-001 for services")
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var ustrd = doc.Descendants(Ns + "Ustrd").Single();
        ustrd.Value.Should().Be("Invoice 2026-001 for services");
    }

    [Fact]
    public void Generate_ChSps_ShouldContainCreditorDetails()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(creditorName: "Test Supplier AG", creditorIban: "CH4431999123000889012")
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var cdtr = doc.Descendants(Ns + "Cdtr").First();
        cdtr.Element(Ns + "Nm")!.Value.Should().Be("Test Supplier AG");

        var cdtrIban = doc.Descendants(Ns + "CdtrAcct").Single()
            .Element(Ns + "Id")!.Element(Ns + "IBAN")!.Value;
        cdtrIban.Should().Be("CH4431999123000889012");
    }

    [Fact]
    public void Generate_ChSps_ShouldContainCorrectAmountAndCurrency()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(amount: 5000.50m, currency: "CHF")
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var instdAmt = doc.Descendants(Ns + "InstdAmt").Single();
        instdAmt.Value.Should().Be("5000.50");
        instdAmt.Attribute("Ccy")!.Value.Should().Be("CHF");
    }

    #endregion

    #region SEPA Generation Tests

    [Fact]
    public void Generate_Sepa_SinglePayment_ShouldProduceValidXml()
    {
        var config = CreateSepaConfig();
        var payments = new List<Pain001PaymentInfo> { CreateSepaPaymentInfo() };

        var xml = _sut.Generate(config, payments);

        xml.Should().NotBeNullOrWhiteSpace();
        var doc = XDocument.Parse(xml);
        doc.Root!.Name.Should().Be(Ns + "Document");
    }

    [Fact]
    public void Generate_Sepa_ShouldHaveSepaServiceLevel()
    {
        var config = CreateSepaConfig();
        var payments = new List<Pain001PaymentInfo> { CreateSepaPaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var svcLvl = doc.Descendants(Ns + "SvcLvl").Single();
        svcLvl.Element(Ns + "Cd")!.Value.Should().Be("SEPA");
    }

    [Fact]
    public void Generate_Sepa_WithCreditorReference_ShouldUseStructuredRemittance()
    {
        var config = CreateSepaConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreateSepaPaymentInfo(creditorReference: "RF18539007547034")
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var strd = doc.Descendants(Ns + "Strd").Single();
        strd.Element(Ns + "CdtrRefInf")!.Element(Ns + "Ref")!.Value
            .Should().Be("RF18539007547034");
    }

    [Fact]
    public void Generate_Sepa_ShouldContainEurAmounts()
    {
        var config = CreateSepaConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreateSepaPaymentInfo(amount: 750.25m)
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var instdAmt = doc.Descendants(Ns + "InstdAmt").Single();
        instdAmt.Value.Should().Be("750.25");
        instdAmt.Attribute("Ccy")!.Value.Should().Be("EUR");
    }

    #endregion

    #region Multiple Payments Tests

    [Fact]
    public void Generate_MultiplePayments_ShouldContainAllTransactions()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(amount: 1000m),
            CreatePaymentInfo(amount: 2000m),
            CreatePaymentInfo(amount: 3000m)
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        doc.Descendants(Ns + "CdtTrfTxInf").Should().HaveCount(3);
    }

    [Fact]
    public void Generate_MultiplePayments_ShouldHaveCorrectControlSum()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(amount: 1000m),
            CreatePaymentInfo(amount: 2500.50m),
            CreatePaymentInfo(amount: 500m)
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var grpHdrCtrlSum = doc.Descendants(Ns + "GrpHdr").Single().Element(Ns + "CtrlSum")!.Value;
        grpHdrCtrlSum.Should().Be("4000.50");

        var pmtInfCtrlSum = doc.Descendants(Ns + "PmtInf").Single().Element(Ns + "CtrlSum")!.Value;
        pmtInfCtrlSum.Should().Be("4000.50");
    }

    [Fact]
    public void Generate_MultiplePayments_ShouldHaveCorrectNbOfTxs()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>
        {
            CreatePaymentInfo(),
            CreatePaymentInfo(),
            CreatePaymentInfo(),
            CreatePaymentInfo(),
            CreatePaymentInfo()
        };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        doc.Descendants(Ns + "GrpHdr").Single().Element(Ns + "NbOfTxs")!.Value.Should().Be("5");
        doc.Descendants(Ns + "PmtInf").Single().Element(Ns + "NbOfTxs")!.Value.Should().Be("5");
    }

    #endregion

    #region Validation Tests

    [Fact]
    public void Validate_NoPayments_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>();

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("At least one payment"));
    }

    [Fact]
    public void Validate_MissingDebtorIban_ShouldReturnError()
    {
        var config = CreateChSpsConfig(debtorIban: "");
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Debtor IBAN is required"));
    }

    [Fact]
    public void Validate_InvalidDebtorIban_ShouldReturnError()
    {
        var config = CreateChSpsConfig(debtorIban: "INVALID");
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("invalid format"));
    }

    [Fact]
    public void Validate_MissingDebtorName_ShouldReturnError()
    {
        var config = CreateChSpsConfig(debtorName: "");
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Debtor name is required"));
    }

    [Fact]
    public void Validate_InvalidDebtorBic_ShouldReturnError()
    {
        var config = CreateChSpsConfig(debtorBic: "XY");
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Debtor BIC") && e.Contains("invalid format"));
    }

    [Fact]
    public void Validate_PaymentAmountZero_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo(amount: 0m) };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Amount must be greater than zero"));
    }

    [Fact]
    public void Validate_PaymentAmountNegative_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo(amount: -100m) };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Amount must be greater than zero"));
    }

    [Fact]
    public void Validate_MissingCreditorName_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var info = CreatePaymentInfo(creditorName: "");

        var result = _sut.Validate(config, new List<Pain001PaymentInfo> { info });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Creditor name is required"));
    }

    [Fact]
    public void Validate_MissingCreditorIban_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var info = CreatePaymentInfo(creditorIban: "");

        var result = _sut.Validate(config, new List<Pain001PaymentInfo> { info });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Creditor IBAN is required"));
    }

    [Fact]
    public void Validate_InvalidCreditorIban_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var info = CreatePaymentInfo(creditorIban: "NOT-AN-IBAN");

        var result = _sut.Validate(config, new List<Pain001PaymentInfo> { info });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Creditor IBAN") && e.Contains("invalid format"));
    }

    [Fact]
    public void Validate_InvalidCreditorBic_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var info = CreatePaymentInfo(creditorBic: "AB");

        var result = _sut.Validate(config, new List<Pain001PaymentInfo> { info });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("Creditor BIC") && e.Contains("invalid format"));
    }

    [Fact]
    public void Validate_EndToEndIdTooLong_ShouldReturnError()
    {
        var config = CreateChSpsConfig();
        var info = new Pain001PaymentInfo
        {
            PaymentId = Guid.NewGuid(),
            EndToEndId = new string('X', 36), // 36 > 35
            Amount = 100m,
            Currency = "CHF",
            CreditorName = "Test",
            CreditorIban = "CH4431999123000889012",
            RequestedExecutionDate = DateTimeOffset.UtcNow
        };

        var result = _sut.Validate(config, new List<Pain001PaymentInfo> { info });

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("EndToEndId exceeds 35 characters"));
    }

    [Fact]
    public void Validate_MessageIdTooLong_ShouldReturnError()
    {
        var config = CreateChSpsConfig(messageId: new string('M', 36));
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.Contains("MessageId exceeds 35 characters"));
    }

    [Fact]
    public void Validate_CurrencyMismatch_ShouldReturnWarning()
    {
        var config = CreateChSpsConfig(currency: "CHF");
        var info = new Pain001PaymentInfo
        {
            PaymentId = Guid.NewGuid(),
            EndToEndId = "E2E-TEST",
            Amount = 100m,
            Currency = "EUR", // does not match CHF
            CreditorName = "Test",
            CreditorIban = "CH4431999123000889012",
            RequestedExecutionDate = DateTimeOffset.UtcNow
        };

        var result = _sut.Validate(config, new List<Pain001PaymentInfo> { info });

        result.Warnings.Should().Contain(w => w.Contains("Currency 'EUR' differs"));
    }

    [Fact]
    public void Validate_ChSps_NonSwissDebtorIban_ShouldWarn()
    {
        var config = CreateChSpsConfig(debtorIban: "DE89370400440532013000");
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.Warnings.Should().Contain(w => w.Contains("not CH/LI"));
    }

    [Fact]
    public void Validate_ValidChSps_ShouldReturnIsValid()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public void Validate_ValidSepa_ShouldReturnIsValid()
    {
        var config = CreateSepaConfig();
        var payments = new List<Pain001PaymentInfo> { CreateSepaPaymentInfo() };

        var result = _sut.Validate(config, payments);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    #endregion

    #region IBAN / BIC Format Tests

    [Theory]
    [InlineData("CH9300762011623852957", true)]
    [InlineData("DE89370400440532013000", true)]
    [InlineData("LI21088100002324013AA", true)]
    [InlineData("GB29 NWBK 6016 1331 9268 19", true)]
    [InlineData("INVALID", false)]
    [InlineData("", false)]
    [InlineData("CH", false)]
    [InlineData("12345678901234", false)]
    public void IsValidIbanFormat_ShouldReturnExpected(string iban, bool expected)
    {
        Pain001Generator.IsValidIbanFormat(iban).Should().Be(expected);
    }

    [Theory]
    [InlineData("POFICHBEXXX", true)]
    [InlineData("COBADEFF", true)]
    [InlineData("UBSWCHZH80A", true)]
    [InlineData("AB", false)]
    [InlineData("", false)]
    [InlineData("TOOLONGBICCODE", false)]
    public void IsValidBicFormat_ShouldReturnExpected(string bic, bool expected)
    {
        Pain001Generator.IsValidBicFormat(bic).Should().Be(expected);
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void Generate_NoBic_ShouldFallbackToOthr()
    {
        var config = CreateChSpsConfig(debtorBic: null);
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo(creditorBic: null) };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var othr = doc.Descendants(Ns + "DbtrAgt").Single()
            .Descendants(Ns + "Othr").SingleOrDefault();
        othr.Should().NotBeNull();
        othr!.Element(Ns + "Id")!.Value.Should().Be("NOTPROVIDED");
    }

    [Fact]
    public void Generate_NoRemittanceInfo_ShouldOmitRmtInf()
    {
        var config = CreateChSpsConfig();
        var info = CreatePaymentInfo(remittanceInfo: null, qrReference: null);

        var xml = _sut.Generate(config, new List<Pain001PaymentInfo> { info });
        var doc = XDocument.Parse(xml);

        doc.Descendants(Ns + "RmtInf").Should().BeEmpty();
    }

    [Fact]
    public void Generate_RequestedExecutionDate_ShouldBeInXml()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var dt = doc.Descendants(Ns + "ReqdExctnDt").Single().Element(Ns + "Dt")!.Value;
        dt.Should().Be("2026-02-28");
    }

    [Fact]
    public void Generate_ShouldHaveBatchBookingTrue()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        doc.Descendants(Ns + "BtchBookg").Single().Value.Should().Be("true");
    }

    [Fact]
    public void Generate_ShouldHavePaymentMethodTRF()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        doc.Descendants(Ns + "PmtMtd").Single().Value.Should().Be("TRF");
    }

    [Fact]
    public void Generate_WithPostalAddress_ShouldIncludeAddressLines()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo> { CreatePaymentInfo() };

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        var cdtrAddr = doc.Descendants(Ns + "CdtTrfTxInf").Single()
            .Element(Ns + "Cdtr")!.Element(Ns + "PstlAdr");
        cdtrAddr.Should().NotBeNull();
        cdtrAddr!.Element(Ns + "Ctry")!.Value.Should().Be("CH");
        cdtrAddr.Elements(Ns + "AdrLine").Should().HaveCountGreaterThan(0);
    }

    [Fact]
    public void Generate_InvalidPayments_ShouldThrow()
    {
        var config = CreateChSpsConfig();
        var payments = new List<Pain001PaymentInfo>(); // empty

        var act = () => _sut.Generate(config, payments);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Cannot generate pain.001*");
    }

    [Fact]
    public void Generate_LargeBatch_ShouldSucceed()
    {
        var config = CreateChSpsConfig();
        var payments = Enumerable.Range(1, 100)
            .Select(i => CreatePaymentInfo(amount: 100m + i))
            .ToList();

        var xml = _sut.Generate(config, payments);
        var doc = XDocument.Parse(xml);

        doc.Descendants(Ns + "CdtTrfTxInf").Should().HaveCount(100);
        doc.Descendants(Ns + "NbOfTxs").First().Value.Should().Be("100");
    }

    #endregion
}
