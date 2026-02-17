using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Invoices;
using IabConnect.Application.Finance.Invoices.Queries;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// REQ-065: Unit tests for GenerateEInvoiceQueryHandler.
/// </summary>
public class GenerateEInvoiceQueryHandlerTests
{
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<IFinanceProfileRepository> _profileRepo = new();
    private readonly Mock<ITaxCodeRepository> _taxCodeRepo = new();
    private readonly Mock<IEInvoiceExporter> _ublExporter = new();
    private readonly GenerateEInvoiceQueryHandler _handler;

    public GenerateEInvoiceQueryHandlerTests()
    {
        _ublExporter.Setup(e => e.Format).Returns(EInvoiceFormat.UBL);
        _handler = new GenerateEInvoiceQueryHandler(
            _invoiceRepo.Object,
            _profileRepo.Object,
            _taxCodeRepo.Object,
            new[] { _ublExporter.Object });
    }

    private static Invoice CreateSentInvoice()
    {
        var invoice = Invoice.Create(
            "INV-2026-001",
            DateTime.UtcNow,
            DateTime.UtcNow.AddDays(30),
            RecipientType.Member,
            Guid.NewGuid(),
            "Max Mustermann",
            "Teststrasse 1",
            7.7m,
            null,
            "test-user");
        invoice.AddItem("Beitrag", 1, 100m);
        invoice.MarkAsSent("test-user");
        return invoice;
    }

    private static Invoice CreateDraftInvoice()
    {
        var invoice = Invoice.Create(
            "INV-2026-002",
            DateTime.UtcNow,
            DateTime.UtcNow.AddDays(30),
            RecipientType.Member,
            Guid.NewGuid(),
            "Draft Person",
            null,
            0m,
            null,
            "test-user");
        invoice.AddItem("Item", 1, 50m);
        return invoice;
    }

    private static FinanceProfile CreateProfile()
    {
        return FinanceProfile.Create(
            Jurisdiction.EU, "CH", FinanceCurrency.CHF, 1,
            "Test Org", "Street 1", "City", "1000", "CH",
            "test@example.com", null, null, null,
            "Bank", "CH00000000000000", "BANKCHZZ");
    }

    [Fact]
    public async Task Should_Return_Null_When_Invoice_Not_Found()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invoice?)null);

        // Act
        var result = await _handler.Handle(new GenerateEInvoiceQuery(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Should_Throw_When_Invoice_Is_Draft()
    {
        // Arrange
        var draftInvoice = CreateDraftInvoice();
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(draftInvoice);

        // Act
        var act = () => _handler.Handle(new GenerateEInvoiceQuery(draftInvoice.Id), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public async Task Should_Throw_When_No_Active_Profile()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        // Act
        var act = () => _handler.Handle(new GenerateEInvoiceQuery(invoice.Id), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*active finance profile*");
    }

    [Fact]
    public async Task Should_Throw_For_Unsupported_Format()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        var profile = CreateProfile();
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // Act
        var act = () => _handler.Handle(new GenerateEInvoiceQuery(invoice.Id, "INVALID_FORMAT"), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Unsupported eInvoice format*");
    }

    [Fact]
    public async Task Should_Throw_When_No_Exporter_For_Format()
    {
        // Arrange — handler only has UBL exporter, request CII
        var invoice = CreateSentInvoice();
        var profile = CreateProfile();
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        // Act
        var act = () => _handler.Handle(new GenerateEInvoiceQuery(invoice.Id, "CII"), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No exporter registered*CII*");
    }

    [Fact]
    public async Task Should_Return_Xml_Bytes_For_Valid_Invoice()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        var profile = CreateProfile();
        var taxCodes = new List<TaxCode>();
        var xmlBytes = "<Invoice />"u8.ToArray();

        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);
        _taxCodeRepo.Setup(r => r.GetAllActiveAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(taxCodes);
        _ublExporter.Setup(e => e.ExportAsync(invoice, profile, taxCodes, It.IsAny<CancellationToken>()))
            .ReturnsAsync(xmlBytes);

        // Act
        var result = await _handler.Handle(new GenerateEInvoiceQuery(invoice.Id, "UBL"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.XmlBytes.Should().BeEquivalentTo(xmlBytes);
        result.ContentType.Should().Be("application/xml");
        result.FileName.Should().Contain("INV-2026-001");
        result.FileName.Should().EndWith(".xml");
    }

    [Fact]
    public async Task Should_Accept_Case_Insensitive_Format()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        var profile = CreateProfile();
        var taxCodes = new List<TaxCode>();

        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);
        _taxCodeRepo.Setup(r => r.GetAllActiveAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(taxCodes);
        _ublExporter.Setup(e => e.ExportAsync(It.IsAny<Invoice>(), It.IsAny<FinanceProfile>(), It.IsAny<IReadOnlyList<TaxCode>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new byte[] { 1, 2, 3 });

        // Act — lowercase "ubl"
        var result = await _handler.Handle(new GenerateEInvoiceQuery(invoice.Id, "ubl"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
    }
}
