using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.BankImports.Commands;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests verifying that matching a BankImportItem to a Payment
/// automatically marks the payment as Paid and creates a ledger Transaction.
/// </summary>
public class MatchBankImportItemAutoBookingTests
{
    private readonly Mock<IBankImportRepository> _bankImportRepo = new();
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IAutoBookingService> _autoBookingService = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();

    private MatchBankImportItemCommandHandler CreateHandler() =>
        new(_bankImportRepo.Object, _paymentRepo.Object,
            _autoBookingService.Object, _unitOfWork.Object, _auditService.Object);

    private static BankImport CreateBankImportWithItem(out BankImportItem item)
    {
        var import = BankImport.Create("export.csv", "admin");
        item = BankImportItem.Create(import.Id, DateTime.UtcNow, "Payment from member", 100m, null, "REF-001");
        import.AddItem(item);
        return import;
    }

    private static Payment CreateDraftPayment(decimal amount = 100m)
        => Payment.Create(DateTime.UtcNow, amount, PaymentDirection.Expense, PaymentMethod.Transfer, "REF-001", null, null, null, "admin");

    private static Payment CreateApprovedPayment(decimal amount = 100m)
    {
        var p = CreateDraftPayment(amount);
        p.Submit("admin");
        p.Approve("treasurer");
        return p;
    }

    private static Payment CreatePaidPayment(decimal amount = 100m)
    {
        var p = CreateDraftPayment(amount);
        p.MarkAsPaid("admin");
        return p;
    }

    #region Auto-booking on match

    [Fact]
    public async Task Match_DraftPayment_Should_MarkAsPaid_And_CreateTransaction()
    {
        // Arrange
        var bankImport = CreateBankImportWithItem(out var item);
        var payment = CreateDraftPayment();
        var dummyTransaction = Transaction.Create(
            DateTime.UtcNow, "Auto", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "admin");

        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _autoBookingService.Setup(s => s.CreateTransactionForPaymentAsync(
                payment, "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(dummyTransaction);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, item.Id, payment.Id, "admin"),
            CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        item.Status.Should().Be(BankImportItemStatus.Matched);
        item.MatchedPaymentId.Should().Be(payment.Id);
        payment.Status.Should().Be(PaymentStatus.Paid);

        _autoBookingService.Verify(
            s => s.CreateTransactionForPaymentAsync(payment, "admin", It.IsAny<CancellationToken>()),
            Times.Once);
        _paymentRepo.Verify(r => r.UpdateAsync(payment, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Match_ApprovedPayment_Should_MarkAsPaid_And_CreateTransaction()
    {
        // Arrange
        var bankImport = CreateBankImportWithItem(out var item);
        var payment = CreateApprovedPayment();
        var dummyTransaction = Transaction.Create(
            DateTime.UtcNow, "Auto", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "admin");

        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _autoBookingService.Setup(s => s.CreateTransactionForPaymentAsync(
                payment, "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(dummyTransaction);

        var handler = CreateHandler();

        // Act
        await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, item.Id, payment.Id, "admin"),
            CancellationToken.None);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Paid);
        _autoBookingService.Verify(
            s => s.CreateTransactionForPaymentAsync(payment, "admin", It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Match_AlreadyPaidPayment_Should_NotCallAutoBooking()
    {
        // Arrange – payment is already Paid, so handler should skip mark + booking
        var bankImport = CreateBankImportWithItem(out var item);
        var payment = CreatePaidPayment();

        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = CreateHandler();

        // Act
        await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, item.Id, payment.Id, "admin"),
            CancellationToken.None);

        // Assert – item is still matched, but no auto-booking
        item.Status.Should().Be(BankImportItemStatus.Matched);
        _autoBookingService.Verify(
            s => s.CreateTransactionForPaymentAsync(It.IsAny<Payment>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _paymentRepo.Verify(r => r.UpdateAsync(It.IsAny<Payment>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Match_PaymentWithExistingTransaction_Should_NotCreateDuplicate()
    {
        // Arrange – Draft payment that already has a TransactionId
        var payment = CreateDraftPayment();
        payment.LinkTransaction(Guid.NewGuid()); // already has a transaction

        var bankImport = CreateBankImportWithItem(out var item);

        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = CreateHandler();

        // Act
        await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, item.Id, payment.Id, "admin"),
            CancellationToken.None);

        // Assert – payment is marked as paid, but no duplicate transaction
        payment.Status.Should().Be(PaymentStatus.Paid);
        _autoBookingService.Verify(
            s => s.CreateTransactionForPaymentAsync(It.IsAny<Payment>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
        _paymentRepo.Verify(r => r.UpdateAsync(payment, It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region Bank import status

    [Fact]
    public async Task Match_LastUnmatchedItem_Should_MarkBankImportAsProcessed()
    {
        // Arrange – single item, matching it should complete the import
        var bankImport = CreateBankImportWithItem(out var item);
        var payment = CreateDraftPayment();
        var dummyTransaction = Transaction.Create(
            DateTime.UtcNow, "Auto", 100m, TransactionType.Income,
            Guid.NewGuid(), null, null, null, "admin");

        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);
        _autoBookingService.Setup(s => s.CreateTransactionForPaymentAsync(
                payment, "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(dummyTransaction);

        var handler = CreateHandler();

        // Act
        await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, item.Id, payment.Id, "admin"),
            CancellationToken.None);

        // Assert
        bankImport.Status.Should().Be(BankImportStatus.Processed);
    }

    #endregion

    #region Not found cases

    [Fact]
    public async Task Match_NonExistentBankImport_Should_ReturnNull()
    {
        // Arrange
        _bankImportRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((BankImport?)null);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(
            new MatchBankImportItemCommand(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), "admin"),
            CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Match_NonExistentItem_Should_ReturnNull()
    {
        // Arrange
        var bankImport = BankImport.Create("file.csv", "admin");
        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, Guid.NewGuid(), Guid.NewGuid(), "admin"),
            CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Match_PaymentNotFound_Should_StillMatchItem()
    {
        // Arrange – payment doesn't exist in repo, but item should still be linked
        var bankImport = CreateBankImportWithItem(out var item);
        var paymentId = Guid.NewGuid();

        _bankImportRepo.Setup(r => r.GetByIdAsync(bankImport.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(bankImport);
        _paymentRepo.Setup(r => r.GetByIdAsync(paymentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var handler = CreateHandler();

        // Act
        var result = await handler.Handle(
            new MatchBankImportItemCommand(bankImport.Id, item.Id, paymentId, "admin"),
            CancellationToken.None);

        // Assert – item is matched but no payment update
        result.Should().NotBeNull();
        item.Status.Should().Be(BankImportItemStatus.Matched);
        item.MatchedPaymentId.Should().Be(paymentId);
        _autoBookingService.Verify(
            s => s.CreateTransactionForPaymentAsync(It.IsAny<Payment>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    #endregion
}
