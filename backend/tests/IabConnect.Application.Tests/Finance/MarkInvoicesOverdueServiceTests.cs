using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Finance.Jobs;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for MarkInvoicesOverdueService (REQ-039 background job)
/// </summary>
public class MarkInvoicesOverdueServiceTests
{
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<ILogger<MarkInvoicesOverdueService>> _logger = new();
    private readonly MarkInvoicesOverdueService _service;

    public MarkInvoicesOverdueServiceTests()
    {
        _service = new MarkInvoicesOverdueService(
            _invoiceRepo.Object, _unitOfWork.Object, _logger.Object);
    }

    private static Invoice CreateSentInvoice(DateTime dueDate)
    {
        var invoice = Invoice.Create(
            $"INV-{Guid.NewGuid():N}"[..16], DateTime.UtcNow, dueDate,
            RecipientType.Member, Guid.NewGuid(), "Test Recipient",
            "Test Address", 0m, null, "admin");
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");
        return invoice;
    }

    [Fact]
    public async Task ExecuteAsync_MarksSentInvoicesPastDueDate()
    {
        // Arrange
        var overdue = CreateSentInvoice(DateTime.UtcNow.AddDays(-5));
        _invoiceRepo.Setup(r => r.GetAllAsync(InvoiceStatus.Sent, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync([overdue]);

        // Act
        var count = await _service.ExecuteAsync(TestContext.Current.CancellationToken);

        // Assert
        count.Should().Be(1);
        overdue.Status.Should().Be(InvoiceStatus.Overdue);
        _invoiceRepo.Verify(r => r.UpdateAsync(overdue, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task ExecuteAsync_SkipsInvoicesNotYetDue()
    {
        // Arrange
        var future = CreateSentInvoice(DateTime.UtcNow.AddDays(30));
        _invoiceRepo.Setup(r => r.GetAllAsync(InvoiceStatus.Sent, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync([future]);

        // Act
        var count = await _service.ExecuteAsync(TestContext.Current.CancellationToken);

        // Assert
        count.Should().Be(0);
        future.Status.Should().Be(InvoiceStatus.Sent);
        _invoiceRepo.Verify(r => r.UpdateAsync(It.IsAny<Invoice>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_NoOp_WhenNoSentInvoices()
    {
        // Arrange
        _invoiceRepo.Setup(r => r.GetAllAsync(InvoiceStatus.Sent, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        // Act
        var count = await _service.ExecuteAsync(TestContext.Current.CancellationToken);

        // Assert
        count.Should().Be(0);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task ExecuteAsync_MixedInvoices_OnlyMarksOverdue()
    {
        // Arrange
        var overdue1 = CreateSentInvoice(DateTime.UtcNow.AddDays(-10));
        var overdue2 = CreateSentInvoice(DateTime.UtcNow.AddDays(-1));
        var notYetDue = CreateSentInvoice(DateTime.UtcNow.AddDays(15));

        _invoiceRepo.Setup(r => r.GetAllAsync(InvoiceStatus.Sent, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync([overdue1, overdue2, notYetDue]);

        // Act
        var count = await _service.ExecuteAsync(TestContext.Current.CancellationToken);

        // Assert
        count.Should().Be(2);
        overdue1.Status.Should().Be(InvoiceStatus.Overdue);
        overdue2.Status.Should().Be(InvoiceStatus.Overdue);
        notYetDue.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public async Task ExecuteAsync_IsIdempotent_RunningTwiceProducesSameResult()
    {
        // Arrange
        var overdue = CreateSentInvoice(DateTime.UtcNow.AddDays(-5));

        // First run: invoice is Sent
        _invoiceRepo.Setup(r => r.GetAllAsync(InvoiceStatus.Sent, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync([overdue]);

        var count1 = await _service.ExecuteAsync(TestContext.Current.CancellationToken);
        count1.Should().Be(1);
        overdue.Status.Should().Be(InvoiceStatus.Overdue);

        // Second run: repo returns empty because there are no more Sent invoices
        _invoiceRepo.Setup(r => r.GetAllAsync(InvoiceStatus.Sent, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync([]);

        var count2 = await _service.ExecuteAsync(TestContext.Current.CancellationToken);
        count2.Should().Be(0);
    }
}
