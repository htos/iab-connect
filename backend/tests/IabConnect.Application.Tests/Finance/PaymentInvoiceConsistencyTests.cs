using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Payments.Commands;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Tests for payment-invoice consistency: when a payment linked to an invoice
/// is deleted or updated, the invoice status should be recalculated.
/// </summary>
public class PaymentInvoiceConsistencyTests
{
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly Mock<IFiscalPeriodService> _fiscalPeriodService = new();

    public PaymentInvoiceConsistencyTests()
    {
        _fiscalPeriodService.Setup(s => s.EnsurePeriodNotLockedAsync(
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
    }

    private static Invoice CreatePaidInvoice(decimal total = 500m)
    {
        var invoice = Invoice.Create(
            "INV-2026-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, Guid.NewGuid(), "Max Mustermann",
            "Teststrasse 1", 0m, null, "admin");
        invoice.AddItem("Service", 1, total);
        invoice.MarkAsSent("admin");
        invoice.MarkAsPaid("admin");
        return invoice;
    }

    private static Invoice CreateSentInvoice(decimal total = 500m)
    {
        var invoice = Invoice.Create(
            "INV-2026-002", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, Guid.NewGuid(), "Max Mustermann",
            "Teststrasse 1", 0m, null, "admin");
        invoice.AddItem("Service", 1, total);
        invoice.MarkAsSent("admin");
        return invoice;
    }

    private static Payment CreatePayment(decimal amount, Guid? invoiceId = null, Guid? transactionId = null)
        => Payment.Create(DateTime.UtcNow, amount, PaymentDirection.Income, PaymentMethod.Transfer, "REF-001",
            invoiceId, transactionId, null, "admin");

    #region Domain — RecalculatePaymentStatus

    [Fact]
    public void RecalculatePaymentStatus_PaidInvoice_ZeroPaid_ShouldRevertToSent()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        invoice.Status.Should().Be(InvoiceStatus.Paid);

        // Act
        invoice.RecalculatePaymentStatus(0m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public void RecalculatePaymentStatus_PaidInvoice_PartialPaid_ShouldRevertToSent()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);

        // Act — only 200 of 500 paid
        invoice.RecalculatePaymentStatus(200m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public void RecalculatePaymentStatus_PaidInvoice_FullyPaid_ShouldRemainPaid()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);

        // Act
        invoice.RecalculatePaymentStatus(500m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public void RecalculatePaymentStatus_PaidInvoice_OverPaid_ShouldRemainPaid()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);

        // Act
        invoice.RecalculatePaymentStatus(600m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public void RecalculatePaymentStatus_SentInvoice_FullyPaid_ShouldMarkAsPaid()
    {
        // Arrange
        var invoice = CreateSentInvoice(500m);
        invoice.Status.Should().Be(InvoiceStatus.Sent);

        // Act
        invoice.RecalculatePaymentStatus(500m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public void RecalculatePaymentStatus_SentInvoice_PartialPaid_ShouldRemainSent()
    {
        // Arrange
        var invoice = CreateSentInvoice(500m);

        // Act
        invoice.RecalculatePaymentStatus(200m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public void RecalculatePaymentStatus_DraftInvoice_ShouldNotChange()
    {
        // Arrange
        var invoice = Invoice.Create(
            "INV-2026-003", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, Guid.NewGuid(), "Test", null, 0m, null, "admin");
        invoice.AddItem("Item", 1, 100m);
        invoice.Status.Should().Be(InvoiceStatus.Draft);

        // Act
        invoice.RecalculatePaymentStatus(100m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Draft);
    }

    [Fact]
    public void RecalculatePaymentStatus_CancelledInvoice_ShouldNotChange()
    {
        // Arrange
        var invoice = CreateSentInvoice(500m);
        invoice.Cancel("No longer needed", "admin");
        invoice.Status.Should().Be(InvoiceStatus.Cancelled);

        // Act
        invoice.RecalculatePaymentStatus(500m, "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Cancelled);
    }

    #endregion

    #region DeletePaymentCommandHandler — Invoice Status Recalculation

    [Fact]
    public async Task DeletePayment_WithInvoice_ShouldRevertPaidToSent_WhenNoRemainingPayments()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        var payment = CreatePayment(500m, invoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        // After soft-delete, no remaining payments
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        var handler = new DeletePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        // Act
        var result = await handler.Handle(
            new DeletePaymentCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        invoice.Status.Should().Be(InvoiceStatus.Sent);
        _invoiceRepo.Verify(r => r.UpdateAsync(invoice, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeletePayment_WithInvoice_ShouldKeepPaid_WhenRemainingPaymentsSufficient()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        var deletedPayment = CreatePayment(200m, invoice.Id);
        var remainingPayment = CreatePayment(500m, invoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(deletedPayment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(deletedPayment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        // After delete, one payment of 500 remains → still >= invoice Total
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { remainingPayment });

        var handler = new DeletePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        // Act
        await handler.Handle(
            new DeletePaymentCommand(deletedPayment.Id, "admin"), CancellationToken.None);

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public async Task DeletePayment_WithInvoice_ShouldRevertPaid_WhenPartiallyPaidAfterDelete()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        var deletedPayment = CreatePayment(300m, invoice.Id);
        var remainingPayment = CreatePayment(200m, invoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(deletedPayment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(deletedPayment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        // After delete, only 200 of 500 covered
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { remainingPayment });

        var handler = new DeletePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        // Act
        await handler.Handle(
            new DeletePaymentCommand(deletedPayment.Id, "admin"), CancellationToken.None);

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public async Task DeletePayment_WithoutInvoice_ShouldNotTouchInvoice()
    {
        // Arrange — payment with no invoice link
        var payment = CreatePayment(100m);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = new DeletePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        // Act
        var result = await handler.Handle(
            new DeletePaymentCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().BeTrue();
        _invoiceRepo.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion

    #region DeletePaymentCommandHandler — Transaction Cleanup

    [Fact]
    public async Task DeletePayment_WithLinkedTransaction_ShouldSoftDeleteTransaction()
    {
        // Arrange
        var transactionId = Guid.NewGuid();
        var transaction = Transaction.Create(
            DateTime.UtcNow, "Auto-booking", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "admin");

        var payment = CreatePayment(100m, transactionId: transactionId);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _transactionRepo.Setup(r => r.GetByIdAsync(transactionId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(transaction);

        var handler = new DeletePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        // Act
        await handler.Handle(
            new DeletePaymentCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        transaction.IsDeleted.Should().BeTrue();
        _transactionRepo.Verify(r => r.UpdateAsync(transaction, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DeletePayment_WithoutLinkedTransaction_ShouldNotTouchTransactions()
    {
        // Arrange
        var payment = CreatePayment(100m);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = new DeletePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        // Act
        await handler.Handle(
            new DeletePaymentCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        _transactionRepo.Verify(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    #endregion

    #region UpdatePaymentCommandHandler — Invoice Status Recalculation

    [Fact]
    public async Task UpdatePayment_ReduceAmount_ShouldRevertInvoiceFromPaidToSent()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        var payment = CreatePayment(500m, invoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        // After update, the payment amount is now 200 (insufficient)
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        var handler = new UpdatePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        var command = new UpdatePaymentCommand
        {
            Id = payment.Id,
            Date = DateTime.UtcNow,
            Amount = 200m,  // reduced from 500 to 200
            Direction = "Income",
            Method = "Transfer",
            InvoiceId = invoice.Id,
            UserName = "admin"
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public async Task UpdatePayment_RemoveInvoiceLink_ShouldRevertOldInvoice()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        var payment = CreatePayment(500m, invoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        // After update with removed invoice link, no payments for old invoice
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        var handler = new UpdatePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        var command = new UpdatePaymentCommand
        {
            Id = payment.Id,
            Date = DateTime.UtcNow,
            Amount = 500m,
            Direction = "Income",
            Method = "Transfer",
            InvoiceId = null,  // removed invoice link
            UserName = "admin"
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
    }

    [Fact]
    public async Task UpdatePayment_MoveToNewInvoice_ShouldRecalculateBothInvoices()
    {
        // Arrange
        var oldInvoice = CreatePaidInvoice(500m);
        var newInvoice = CreateSentInvoice(300m);
        var payment = CreatePayment(500m, oldInvoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(oldInvoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(oldInvoice);
        _invoiceRepo.Setup(r => r.GetByIdAsync(newInvoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(newInvoice);
        // Old invoice: no remaining payments after move
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(oldInvoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());
        // New invoice: this payment now assigned (500 >= 300)
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(newInvoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        var handler = new UpdatePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        var command = new UpdatePaymentCommand
        {
            Id = payment.Id,
            Date = DateTime.UtcNow,
            Amount = 500m,
            Direction = "Income",
            Method = "Transfer",
            InvoiceId = newInvoice.Id,  // moved to new invoice
            UserName = "admin"
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        oldInvoice.Status.Should().Be(InvoiceStatus.Sent);  // reverted
        newInvoice.Status.Should().Be(InvoiceStatus.Paid);   // now fully paid
    }

    [Fact]
    public async Task UpdatePayment_SameInvoice_SufficientAmount_ShouldKeepPaid()
    {
        // Arrange
        var invoice = CreatePaidInvoice(500m);
        var payment = CreatePayment(500m, invoice.Id);

        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _invoiceRepo.Setup(r => r.GetByIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(invoice);
        _paymentRepo.Setup(r => r.GetByInvoiceIdAsync(invoice.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        var handler = new UpdatePaymentCommandHandler(
            _paymentRepo.Object, _invoiceRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object);

        var command = new UpdatePaymentCommand
        {
            Id = payment.Id,
            Date = DateTime.UtcNow,
            Amount = 600m,  // increased amount, still covers
            Direction = "Income",
            Method = "Transfer",
            InvoiceId = invoice.Id,
            UserName = "admin"
        };

        // Act
        await handler.Handle(command, CancellationToken.None);

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    #endregion
}
