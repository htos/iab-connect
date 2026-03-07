using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Accounting;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Microsoft.Extensions.Logging;
using Moq;
using Xunit;
using Xunit.v3;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// REQ-084: Unit tests for BackfillDoubleEntryCommandHandler.
/// </summary>
public sealed class BackfillDoubleEntryCommandHandlerTests
{
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IJournalEntryRepository> _journalEntryRepo = new();
    private readonly Mock<IAccountingPostingService> _postingService = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly Mock<ILogger<BackfillDoubleEntryCommandHandler>> _logger = new();

    private readonly BackfillDoubleEntryCommandHandler _handler;

    public BackfillDoubleEntryCommandHandlerTests()
    {
        _postingService.Setup(s => s.IsDoubleEntryEnabledAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        _handler = new BackfillDoubleEntryCommandHandler(
            _transactionRepo.Object,
            _paymentRepo.Object,
            _journalEntryRepo.Object,
            _postingService.Object,
            _unitOfWork.Object,
            _auditService.Object,
            _logger.Object);
    }

    private static readonly Guid TestFinanceProfileId = Guid.NewGuid();

    private static JournalEntry CreateJournalEntry() =>
        JournalEntry.Create(DateTime.UtcNow, "Test entry", TestFinanceProfileId, "admin");

    private static BackfillDoubleEntryCommand CreateCommand(DateTime? cutOff = null) =>
        new() { CutOffDate = cutOff ?? new DateTime(2024, 1, 1, 0, 0, 0, DateTimeKind.Utc), UserName = "admin" };

    [Fact]
    public async Task Handle_WhenDoubleEntryNotEnabled_ThrowsInvalidOperation()
    {
        _postingService.Setup(s => s.IsDoubleEntryEnabledAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var act = () => _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not enabled*");
    }

    [Fact]
    public async Task Handle_WithNoData_ReturnsEmptyResult()
    {
        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction>());
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        var result = await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        result.TransactionsProcessed.Should().Be(0);
        result.PaymentsProcessed.Should().Be(0);
        result.JournalEntriesCreated.Should().Be(0);
        result.SkippedAlreadyPosted.Should().Be(0);
        result.ErrorCount.Should().Be(0);
    }

    [Fact]
    public async Task Handle_PostsTransactionsAndPayments()
    {
        var txn = CreateTransaction();
        var payment = CreatePayment();

        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction> { txn });
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });
        _journalEntryRepo.Setup(r => r.GetBySourceAsync(
                It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<JournalEntry>());
        _postingService.Setup(s => s.PostTransactionAsync(
                txn, "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateJournalEntry());
        _postingService.Setup(s => s.PostPaymentAsync(
                payment, "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateJournalEntry());

        var result = await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        result.TransactionsProcessed.Should().Be(1);
        result.PaymentsProcessed.Should().Be(1);
        result.JournalEntriesCreated.Should().Be(2);
        result.ErrorCount.Should().Be(0);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_SkipsAlreadyPostedEntries()
    {
        var txn = CreateTransaction();

        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction> { txn });
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());
        _journalEntryRepo.Setup(r => r.GetBySourceAsync(
                "Transaction", txn.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<JournalEntry> { CreateJournalEntry() });

        var result = await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        result.SkippedAlreadyPosted.Should().Be(1);
        result.JournalEntriesCreated.Should().Be(0);
        _postingService.Verify(
            s => s.PostTransactionAsync(It.IsAny<Transaction>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_FiltersOutSoftDeletedTransactions()
    {
        var deleted = CreateTransaction(deleted: true);

        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction> { deleted });
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        var result = await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        result.TransactionsProcessed.Should().Be(0);
        _postingService.Verify(
            s => s.PostTransactionAsync(It.IsAny<Transaction>(), It.IsAny<string>(), It.IsAny<CancellationToken>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_CollectsErrorsWithoutStopping()
    {
        var txn1 = CreateTransaction();
        var txn2 = CreateTransaction();

        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction> { txn1, txn2 });
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());
        _journalEntryRepo.Setup(r => r.GetBySourceAsync(
                It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<JournalEntry>());

        // First transaction fails
        _postingService.Setup(s => s.PostTransactionAsync(
                txn1, "admin", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("Missing mapping"));
        // Second transaction succeeds
        _postingService.Setup(s => s.PostTransactionAsync(
                txn2, "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateJournalEntry());

        var result = await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        result.JournalEntriesCreated.Should().Be(1);
        result.ErrorCount.Should().Be(1);
        result.Errors.Should().ContainSingle(e => e.SourceId == txn1.Id);
    }

    [Fact]
    public async Task Handle_LogsAuditEntry()
    {
        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction>());
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceCreated,
            It.Is<string>(s => s.Contains("Backfill completed")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_FiltersPaymentsByStatusAndDate()
    {
        var paidAfterCutoff = CreatePayment(status: PaymentStatus.Paid, date: new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var draftPayment = CreatePayment(status: PaymentStatus.Draft, date: new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var paidBeforeCutoff = CreatePayment(status: PaymentStatus.Paid, date: new DateTime(2023, 6, 1, 0, 0, 0, DateTimeKind.Utc));
        var linkedPayment = CreatePayment(status: PaymentStatus.Paid, date: new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc), transactionId: Guid.NewGuid());

        _transactionRepo.Setup(r => r.GetAllAsync(
                It.IsAny<DateTime?>(), null, null, false, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Transaction>());
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { paidAfterCutoff, draftPayment, paidBeforeCutoff, linkedPayment });
        _journalEntryRepo.Setup(r => r.GetBySourceAsync(
                It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<JournalEntry>());
        _postingService.Setup(s => s.PostPaymentAsync(
                It.IsAny<Payment>(), "admin", It.IsAny<CancellationToken>()))
            .ReturnsAsync(CreateJournalEntry());

        var result = await _handler.Handle(CreateCommand(), TestContext.Current.CancellationToken);

        // Only paidAfterCutoff should be processed
        result.PaymentsProcessed.Should().Be(1);
        _postingService.Verify(
            s => s.PostPaymentAsync(paidAfterCutoff, "admin", It.IsAny<CancellationToken>()), Times.Once);
        _postingService.Verify(
            s => s.PostPaymentAsync(draftPayment, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _postingService.Verify(
            s => s.PostPaymentAsync(linkedPayment, It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // --- Helpers ---

    private static Transaction CreateTransaction(bool deleted = false)
    {
        var txn = Transaction.Create(
            date: new DateTime(2024, 3, 15, 0, 0, 0, DateTimeKind.Utc),
            description: "Test transaction",
            amount: 100m,
            type: TransactionType.Income,
            accountId: Guid.NewGuid(),
            categoryId: Guid.NewGuid(),
            reference: "TXN-001",
            notes: null,
            createdBy: "admin");
        if (deleted) txn.SoftDelete("admin");
        return txn;
    }

    private static Payment CreatePayment(
        PaymentStatus status = PaymentStatus.Paid,
        DateTime? date = null,
        Guid? transactionId = null)
    {
        var payment = Payment.Create(
            date: date ?? new DateTime(2024, 6, 1, 0, 0, 0, DateTimeKind.Utc),
            amount: 50m,
            direction: PaymentDirection.Income,
            method: PaymentMethod.Transfer,
            reference: "PAY-001",
            invoiceId: null,
            transactionId: transactionId,
            notes: null,
            createdBy: "admin");
        // Advance status to target
        if (status == PaymentStatus.Paid)
        {
            payment.MarkAsPaid("admin");
        }
        return payment;
    }
}
