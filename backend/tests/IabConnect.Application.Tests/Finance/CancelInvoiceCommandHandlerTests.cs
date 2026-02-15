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
/// Unit tests for CancelInvoiceCommandHandler (REQ-039 – storno flow)
/// </summary>
public class CancelInvoiceCommandHandlerTests
{
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly CancelInvoiceCommandHandler _handler;

    public CancelInvoiceCommandHandlerTests()
    {
        _handler = new CancelInvoiceCommandHandler(
            _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object);
    }

    private static Invoice CreateSentInvoice()
    {
        var invoice = Invoice.Create(
            "INV-2026-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, Guid.NewGuid(), "Max Mustermann",
            "Teststrasse 1", 0m, null, "admin");
        invoice.AddItem("Mitgliedsbeitrag", 1, 100m);
        invoice.MarkAsSent("admin");
        return invoice;
    }

    private CancelInvoiceCommand CreateCommand(Guid invoiceId) => new()
    {
        Id = invoiceId,
        Reason = "Customer withdrew",
        AccountId = Guid.NewGuid(),
        UserName = "admin"
    };

    [Fact]
    public async Task Handle_SentInvoice_ShouldCancelSuccessfully()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        var result = await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Cancelled");
    }

    [Fact]
    public async Task Handle_SentInvoice_ShouldCreateStornoTransaction()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        _transactionRepo.Verify(r => r.AddAsync(
            It.Is<Transaction>(t =>
                t.Description.Contains("STORNO") &&
                t.Amount == invoice.Total &&
                t.Type == TransactionType.Expense),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldPersistChanges()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        _invoiceRepo.Verify(r => r.UpdateAsync(invoice, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NonExistentInvoice_ShouldReturnFailure()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invoice?)null);

        // Act
        var result = await _handler.Handle(CreateCommand(Guid.NewGuid()), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().Contain("not found");
    }

    [Fact]
    public async Task Handle_DraftInvoice_ShouldReturnFailure()
    {
        // Arrange
        var invoice = Invoice.Create(
            "INV-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Name", null, 0m, null, "admin");
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        var result = await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
        result.Error.Should().NotBeNullOrEmpty();
    }

    [Fact]
    public async Task Handle_PaidInvoice_ShouldReturnFailure()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        invoice.MarkAsPaid("admin");
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        var result = await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_OverdueInvoice_ShouldCancelSuccessfully()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        invoice.MarkAsOverdue("admin");
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        var result = await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        result.IsSuccess.Should().BeTrue();
        result.Value!.Status.Should().Be("Cancelled");
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        var invoice = CreateSentInvoice();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        await _handler.Handle(CreateCommand(invoice.Id), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            It.Is<string>(s => s.Contains("cancelled") || s.Contains("storno")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Invoice",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
