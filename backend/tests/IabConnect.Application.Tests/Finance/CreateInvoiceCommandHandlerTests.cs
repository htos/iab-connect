using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Invoices.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for CreateInvoiceCommandHandler (REQ-039)
/// </summary>
public class CreateInvoiceCommandHandlerTests
{
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<ITaxCodeRepository> _taxCodeRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly Mock<IFiscalPeriodService> _fiscalPeriodService = new();
    private readonly CreateInvoiceCommandHandler _handler;

    public CreateInvoiceCommandHandlerTests()
    {
        _handler = new CreateInvoiceCommandHandler(
            _invoiceRepo.Object, _taxCodeRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);
    }

    private static CreateInvoiceCommand CreateValidCommand() => new()
    {
        Date = DateTime.UtcNow,
        DueDate = DateTime.UtcNow.AddDays(30),
        RecipientType = "Member",
        RecipientId = Guid.NewGuid(),
        RecipientName = "Max Mustermann",
        RecipientAddress = "Teststrasse 1, 3000 Bern",
        TaxRate = 7.7m,
        Notes = "Test",
        Items = [new("Mitgliedsbeitrag", 1, 100m)],
        UserName = "admin"
    };

    [Fact]
    public async Task Handle_ValidCommand_ShouldCreateInvoice()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetNextInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("INV-2026-001");
        var command = CreateValidCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.InvoiceNumber.Should().Be("INV-2026-001");
        result.RecipientName.Should().Be("Max Mustermann");

        _invoiceRepo.Verify(r => r.AddAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldGenerateInvoiceNumber()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetNextInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("INV-2026-042");
        var command = CreateValidCommand();

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.InvoiceNumber.Should().Be("INV-2026-042");
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetNextInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("INV-2026-001");
        var command = CreateValidCommand();

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceCreated,
            It.Is<string>(s => s.Contains("INV-2026-001")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Invoice",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithTaxCodeItem_ShouldLookupTaxRate()
    {
        // Arrange
        var taxCodeId = Guid.NewGuid();
        var taxCode = TaxCode.Create("MWST77", "MWST 7.7%", 0.077m);
        _taxCodeRepo.Setup(r => r.GetByIdAsync(taxCodeId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(taxCode);
        _invoiceRepo.Setup(r => r.GetNextInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("INV-001");

        var command = new CreateInvoiceCommand
        {
            Date = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(30),
            RecipientType = "Member",
            RecipientName = "Test Member",
            TaxRate = 0m,
            Items = [new("Service", 1, 100m, TaxCodeId: taxCodeId)],
            UserName = "admin"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        _taxCodeRepo.Verify(r => r.GetByIdAsync(taxCodeId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithNonexistentTaxCode_ShouldAddItemWithNullRate()
    {
        // Arrange
        _taxCodeRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((TaxCode?)null);
        _invoiceRepo.Setup(r => r.GetNextInvoiceNumberAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync("INV-001");

        var command = new CreateInvoiceCommand
        {
            Date = DateTime.UtcNow,
            DueDate = DateTime.UtcNow.AddDays(30),
            RecipientType = "Member",
            RecipientName = "Test Member",
            TaxRate = 0m,
            Items = [new("Service", 1, 100m, TaxCodeId: Guid.NewGuid())],
            UserName = "admin"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert — should succeed without exception
        result.Should().NotBeNull();
        _invoiceRepo.Verify(r => r.AddAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
