using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Exports.Pain001;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// REQ-073: Unit tests for ExportPain001QueryHandler.
/// </summary>
public class ExportPain001QueryHandlerTests
{
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IFinanceProfileRepository> _profileRepo = new();
    private readonly Mock<IPain001Generator> _generator = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly ExportPain001QueryHandler _sut;

    public ExportPain001QueryHandlerTests()
    {
        _sut = new ExportPain001QueryHandler(
            _paymentRepo.Object,
            _profileRepo.Object,
            _generator.Object,
            _auditService.Object);
    }

    #region Test Helpers

    private static FinanceProfile CreateTestProfile(
        string bankIban = "CH9300762011623852957",
        string? bankBic = "POFICHBEXXX") =>
        FinanceProfile.Create(
            Jurisdiction.CH,
            "CH",
            FinanceCurrency.CHF,
            1,
            "IAB Kulturverein",
            "Musterstrasse 1",
            "Zürich",
            "8000",
            "CH",
            null, null, null, null,
            "PostFinance",
            bankIban,
            bankBic);

    private static Payment CreateApprovedPayment(decimal amount = 1000m, string? reference = "CH4431999123000889012")
    {
        var payment = Payment.Create(
            DateTime.UtcNow,
            amount,
            PaymentDirection.Expense,
            PaymentMethod.Transfer,
            reference,
            null,
            null,
            "Test payment",
            "test-user");
        payment.Submit("test-user");
        payment.Approve("approver");
        return payment;
    }

    #endregion

    [Fact]
    public async Task Handle_NoProfile_ShouldThrow()
    {
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        var query = new ExportPain001Query
        {
            PaymentIds = [Guid.NewGuid()],
            Profile = Pain001Profile.ChSps
        };

        var act = () => _sut.Handle(query, CancellationToken.None);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*finance profile*");
    }

    [Fact]
    public async Task Handle_ValidationFails_ShouldReturnEmptyResult()
    {
        var profile = CreateTestProfile();
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var paymentIds = new List<Guid> { Guid.NewGuid() };
        _paymentRepo.Setup(r => r.GetByIdsAsync(paymentIds, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        var validationResult = new Pain001ValidationResult { Errors = { "At least one payment is required." } };
        _generator.Setup(g => g.Validate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns(validationResult);

        var query = new ExportPain001Query
        {
            PaymentIds = paymentIds,
            Profile = Pain001Profile.ChSps
        };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Validation.IsValid.Should().BeFalse();
        result.Xml.Should().BeEmpty();
        result.FileName.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ValidPayments_ShouldGenerateXml()
    {
        var profile = CreateTestProfile();
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var payment = CreateApprovedPayment();
        var paymentIds = new List<Guid> { payment.Id };
        _paymentRepo.Setup(r => r.GetByIdsAsync(paymentIds, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        var validationResult = new Pain001ValidationResult();
        _generator.Setup(g => g.Validate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns(validationResult);
        _generator.Setup(g => g.Generate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns("<xml>test</xml>");

        var query = new ExportPain001Query
        {
            PaymentIds = paymentIds,
            Profile = Pain001Profile.ChSps,
            RequestedExecutionDate = new DateTimeOffset(2026, 2, 28, 0, 0, 0, TimeSpan.Zero)
        };

        var result = await _sut.Handle(query, CancellationToken.None);

        result.Validation.IsValid.Should().BeTrue();
        result.Xml.Should().Be("<xml>test</xml>");
        result.PaymentCount.Should().Be(1);
        result.FileName.Should().Contain("pain001");
    }

    [Fact]
    public async Task Handle_ShouldAuditExport()
    {
        var profile = CreateTestProfile();
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var payment = CreateApprovedPayment(amount: 2500m);
        var paymentIds = new List<Guid> { payment.Id };
        _paymentRepo.Setup(r => r.GetByIdsAsync(paymentIds, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        _generator.Setup(g => g.Validate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns(new Pain001ValidationResult());
        _generator.Setup(g => g.Generate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns("<xml/>");

        var query = new ExportPain001Query
        {
            PaymentIds = paymentIds,
            Profile = Pain001Profile.ChSps
        };

        await _sut.Handle(query, CancellationToken.None);

        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceExported,
            It.Is<string>(s => s.Contains("pain.001")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Payment",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ChSps_ShouldUseCHF()
    {
        var profile = CreateTestProfile();
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var payment = CreateApprovedPayment();
        _paymentRepo.Setup(r => r.GetByIdsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        Pain001Config? capturedConfig = null;
        _generator.Setup(g => g.Validate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Callback<Pain001Config, IReadOnlyList<Pain001PaymentInfo>>((c, _) => capturedConfig = c)
            .Returns(new Pain001ValidationResult());
        _generator.Setup(g => g.Generate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns("<xml/>");

        await _sut.Handle(new ExportPain001Query
        {
            PaymentIds = [payment.Id],
            Profile = Pain001Profile.ChSps
        }, CancellationToken.None);

        capturedConfig.Should().NotBeNull();
        capturedConfig!.Currency.Should().Be("CHF");
        capturedConfig.Profile.Should().Be(Pain001Profile.ChSps);
    }

    [Fact]
    public async Task Handle_Sepa_ShouldUseEUR()
    {
        var profile = CreateTestProfile(bankIban: "DE89370400440532013000", bankBic: "COBADEFFXXX");
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var payment = CreateApprovedPayment();
        _paymentRepo.Setup(r => r.GetByIdsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        Pain001Config? capturedConfig = null;
        _generator.Setup(g => g.Validate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Callback<Pain001Config, IReadOnlyList<Pain001PaymentInfo>>((c, _) => capturedConfig = c)
            .Returns(new Pain001ValidationResult());
        _generator.Setup(g => g.Generate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns("<xml/>");

        await _sut.Handle(new ExportPain001Query
        {
            PaymentIds = [payment.Id],
            Profile = Pain001Profile.Sepa
        }, CancellationToken.None);

        capturedConfig.Should().NotBeNull();
        capturedConfig!.Currency.Should().Be("EUR");
        capturedConfig.Profile.Should().Be(Pain001Profile.Sepa);
    }

    [Fact]
    public async Task Handle_MultiplePayments_ShouldMapAll()
    {
        var profile = CreateTestProfile();
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        var p1 = CreateApprovedPayment(amount: 1000m);
        var p2 = CreateApprovedPayment(amount: 2000m);
        var p3 = CreateApprovedPayment(amount: 3000m);

        _paymentRepo.Setup(r => r.GetByIdsAsync(It.IsAny<List<Guid>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { p1, p2, p3 });

        IReadOnlyList<Pain001PaymentInfo>? capturedPayments = null;
        _generator.Setup(g => g.Validate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Callback<Pain001Config, IReadOnlyList<Pain001PaymentInfo>>((_, p) => capturedPayments = p)
            .Returns(new Pain001ValidationResult());
        _generator.Setup(g => g.Generate(It.IsAny<Pain001Config>(), It.IsAny<IReadOnlyList<Pain001PaymentInfo>>()))
            .Returns("<xml/>");

        await _sut.Handle(new ExportPain001Query
        {
            PaymentIds = [p1.Id, p2.Id, p3.Id],
            Profile = Pain001Profile.ChSps
        }, CancellationToken.None);

        capturedPayments.Should().HaveCount(3);
    }

    #region MapPayments Tests

    [Fact]
    public void MapPayments_ShouldSetEndToEndId()
    {
        var payment = CreateApprovedPayment();
        var result = ExportPain001QueryHandler.MapPayments([payment], "CHF", DateTimeOffset.UtcNow);

        result.Should().HaveCount(1);
        result[0].EndToEndId.Should().StartWith("E2E-");
        result[0].EndToEndId.Length.Should().BeLessThanOrEqualTo(35);
    }

    [Fact]
    public void MapPayments_ShouldPreserveAmount()
    {
        var payment = CreateApprovedPayment(amount: 1234.56m);
        var result = ExportPain001QueryHandler.MapPayments([payment], "CHF", DateTimeOffset.UtcNow);

        result[0].Amount.Should().Be(1234.56m);
    }

    [Fact]
    public void MapPayments_ShouldUseReferenceAsCreditorIban()
    {
        var payment = CreateApprovedPayment(reference: "CH9300762011623852957");
        var result = ExportPain001QueryHandler.MapPayments([payment], "CHF", DateTimeOffset.UtcNow);

        result[0].CreditorIban.Should().Be("CH9300762011623852957");
    }

    #endregion

    #region ParseAddress Tests

    [Fact]
    public void ParseAddress_StreetAndCity_ShouldParseBothParts()
    {
        ExportPain001QueryHandler.ParseAddress(
            "Musterstrasse 1, 8000 Zürich",
            out var street, out var city, out var postalCode, out var country);

        street.Should().Be("Musterstrasse 1");
        postalCode.Should().Be("8000");
        city.Should().Be("Zürich");
    }

    [Fact]
    public void ParseAddress_CityOnly_ShouldSetCityWithoutPostalCode()
    {
        ExportPain001QueryHandler.ParseAddress(
            "Musterstrasse 1, Zürich",
            out var street, out var city, out var postalCode, out _);

        street.Should().Be("Musterstrasse 1");
        city.Should().Be("Zürich");
        postalCode.Should().BeNull();
    }

    [Fact]
    public void ParseAddress_SingleLine_ShouldSetStreetOnly()
    {
        ExportPain001QueryHandler.ParseAddress(
            "Musterstrasse 1",
            out var street, out var city, out var postalCode, out _);

        street.Should().Be("Musterstrasse 1");
        city.Should().BeNull();
        postalCode.Should().BeNull();
    }

    #endregion
}
