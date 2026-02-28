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
/// Unit tests for MarkInvoiceAsOverdueCommandHandler (REQ-039)
/// </summary>
public class MarkInvoiceAsOverdueCommandHandlerTests
{
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly MarkInvoiceAsOverdueCommandHandler _handler;

    public MarkInvoiceAsOverdueCommandHandlerTests()
    {
        _handler = new MarkInvoiceAsOverdueCommandHandler(
            _invoiceRepo.Object, _unitOfWork.Object, _auditService.Object);
    }

    private static Invoice CreateSentInvoiceWithPastDueDate()
    {
        var invoice = Invoice.Create(
            "INV-2026-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(-5),
            RecipientType.Member, Guid.NewGuid(), "Max Mustermann",
            "Teststrasse 1", 0m, null, "admin");
        invoice.AddItem("Mitgliedsbeitrag", 1, 100m);
        invoice.MarkAsSent("admin");
        return invoice;
    }

    private static Invoice CreateSentInvoiceWithFutureDueDate()
    {
        var invoice = Invoice.Create(
            "INV-2026-002", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, Guid.NewGuid(), "Max Mustermann",
            "Teststrasse 1", 0m, null, "admin");
        invoice.AddItem("Mitgliedsbeitrag", 1, 100m);
        invoice.MarkAsSent("admin");
        return invoice;
    }

    [Fact]
    public async Task Handle_SentInvoiceWithPastDueDate_ShouldMarkAsOverdue()
    {
        // Arrange
        var invoice = CreateSentInvoiceWithPastDueDate();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        var result = await _handler.Handle(
            new MarkInvoiceAsOverdueCommand(invoice.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Overdue");
    }

    [Fact]
    public async Task Handle_ShouldPersistChanges()
    {
        // Arrange
        var invoice = CreateSentInvoiceWithPastDueDate();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        await _handler.Handle(
            new MarkInvoiceAsOverdueCommand(invoice.Id, "admin"), CancellationToken.None);

        // Assert
        _invoiceRepo.Verify(r => r.UpdateAsync(invoice, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        var invoice = CreateSentInvoiceWithPastDueDate();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act
        await _handler.Handle(
            new MarkInvoiceAsOverdueCommand(invoice.Id, "admin"), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceStatusChanged,
            It.Is<string>(s => s.Contains("overdue")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Invoice",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NonExistentInvoice_ShouldReturnNull()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Invoice?)null);

        // Act
        var result = await _handler.Handle(
            new MarkInvoiceAsOverdueCommand(Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_DraftInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = Invoice.Create(
            "INV-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(-5),
            RecipientType.Member, null, "Name", null, 0m, null, "admin");
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act & Assert
        var act = () => _handler.Handle(
            new MarkInvoiceAsOverdueCommand(invoice.Id, "admin"), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*sent*");
    }

    [Fact]
    public async Task Handle_InvoiceWithFutureDueDate_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateSentInvoiceWithFutureDueDate();
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act & Assert
        var act = () => _handler.Handle(
            new MarkInvoiceAsOverdueCommand(invoice.Id, "admin"), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*due date*");
    }

    [Fact]
    public async Task Handle_PaidInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateSentInvoiceWithPastDueDate();
        invoice.MarkAsPaid("admin");
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);

        // Act & Assert
        var act = () => _handler.Handle(
            new MarkInvoiceAsOverdueCommand(invoice.Id, "admin"), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
