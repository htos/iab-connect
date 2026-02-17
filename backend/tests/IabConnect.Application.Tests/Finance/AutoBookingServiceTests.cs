using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for AutoBookingService – automatic ledger transaction creation.
/// </summary>
public class AutoBookingServiceTests
{
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IAccountRepository> _accountRepo = new();
    private readonly AutoBookingService _sut;

    private static readonly Guid DefaultAccountId = Guid.NewGuid();

    public AutoBookingServiceTests()
    {
        // Default: one active account available
        var account = Account.Create("Hauptkonto", "1000", AccountType.Bank, "Main", 1, "admin");
        // Use reflection to set the known Id for assertions
        typeof(IabConnect.Domain.Common.Entity)
            .GetProperty("Id")!
            .SetValue(account, DefaultAccountId);

        _accountRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account> { account });

        _sut = new AutoBookingService(_transactionRepo.Object, _accountRepo.Object);
    }

    #region CreateTransactionForPaymentAsync

    [Fact]
    public async Task CreateTransactionForPayment_WithInvoice_Should_Create_Income_Transaction()
    {
        // Arrange
        var invoiceId = Guid.NewGuid();
        var payment = Payment.Create(
            DateTime.UtcNow, 250m, PaymentDirection.Income, PaymentMethod.Transfer, "REF-001",
            invoiceId, null, null, "admin");

        Transaction? captured = null;
        _transactionRepo.Setup(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()))
            .Callback<Transaction, CancellationToken>((t, _) => captured = t)
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateTransactionForPaymentAsync(payment, "admin", CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Type.Should().Be(TransactionType.Income);
        result.Amount.Should().Be(250m);
        result.AccountId.Should().Be(DefaultAccountId);
        result.Description.Should().Contain("Income");
        result.Notes.Should().Contain(payment.Id.ToString());
        payment.TransactionId.Should().Be(result.Id);

        _transactionRepo.Verify(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateTransactionForPayment_Standalone_Should_Create_Expense_Transaction()
    {
        // Arrange – no invoice linked
        var payment = Payment.Create(
            DateTime.UtcNow, 80m, PaymentDirection.Expense, PaymentMethod.Cash, null,
            null, null, "Office supplies", "admin");

        _transactionRepo.Setup(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateTransactionForPaymentAsync(payment, "admin", CancellationToken.None);

        // Assert
        result.Type.Should().Be(TransactionType.Expense);
        result.Amount.Should().Be(80m);
        result.AccountId.Should().Be(DefaultAccountId);
        payment.TransactionId.Should().Be(result.Id);
    }

    [Fact]
    public async Task CreateTransactionForPayment_Should_Use_Payment_Reference()
    {
        // Arrange
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentDirection.Expense, PaymentMethod.Transfer, "INV-2026-001",
            null, null, null, "admin");

        _transactionRepo.Setup(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateTransactionForPaymentAsync(payment, "admin", CancellationToken.None);

        // Assert
        result.Reference.Should().Be("INV-2026-001");
    }

    [Fact]
    public async Task CreateTransactionForPayment_Should_Throw_When_No_Active_Account()
    {
        // Arrange – no accounts
        _accountRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account>());

        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentDirection.Expense, PaymentMethod.Transfer, null,
            null, null, null, "admin");

        // Act
        var act = () => _sut.CreateTransactionForPaymentAsync(payment, "admin", CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*No active account*");
    }

    [Fact]
    public async Task CreateTransactionForPayment_Should_Skip_Inactive_Accounts()
    {
        // Arrange – one inactive, one active
        var inactive = Account.Create("Inactive", "9999", AccountType.Other, null, 1, "admin");
        inactive.Deactivate();

        var active = Account.Create("Active", "1001", AccountType.Bank, null, 2, "admin");
        var activeId = active.Id;

        _accountRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Account> { inactive, active });

        var payment = Payment.Create(
            DateTime.UtcNow, 50m, PaymentDirection.Expense, PaymentMethod.Cash, null,
            null, null, null, "admin");

        _transactionRepo.Setup(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateTransactionForPaymentAsync(payment, "admin", CancellationToken.None);

        // Assert
        result.AccountId.Should().Be(activeId);
    }

    #endregion

    #region CreateTransactionForExpenseClaimAsync

    [Fact]
    public async Task CreateTransactionForExpenseClaim_Should_Create_Expense_Transaction()
    {
        // Arrange
        var claim = ExpenseClaim.Create(
            "Conference Travel", "Train tickets", 150m, FinanceCurrency.CHF,
            DateTime.UtcNow, Guid.NewGuid(), "Max Muster", null, "admin");

        var payment = Payment.Create(
            DateTime.UtcNow, 150m, PaymentDirection.Expense, PaymentMethod.Transfer, "REIMB-001",
            null, null, "Reimbursement", "admin");

        _transactionRepo.Setup(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateTransactionForExpenseClaimAsync(claim, payment, "admin", CancellationToken.None);

        // Assert
        result.Type.Should().Be(TransactionType.Expense);
        result.Amount.Should().Be(150m);
        result.AccountId.Should().Be(DefaultAccountId);
        result.Description.Should().Contain("Conference Travel");
        result.Description.Should().Contain(claim.Id.ToString());
        result.Notes.Should().Contain(claim.Id.ToString());
        payment.TransactionId.Should().Be(result.Id);

        _transactionRepo.Verify(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task CreateTransactionForExpenseClaim_Should_Use_Payment_Reference()
    {
        // Arrange
        var claim = ExpenseClaim.Create(
            "Supplies", "Pens and paper", 30m, FinanceCurrency.CHF,
            DateTime.UtcNow, Guid.NewGuid(), "Hans", null, "admin");

        var payment = Payment.Create(
            DateTime.UtcNow, 30m, PaymentDirection.Expense, PaymentMethod.Cash, "REF-EXP-001",
            null, null, null, "admin");

        _transactionRepo.Setup(r => r.AddAsync(It.IsAny<Transaction>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        // Act
        var result = await _sut.CreateTransactionForExpenseClaimAsync(claim, payment, "admin", CancellationToken.None);

        // Assert
        result.Reference.Should().Be("REF-EXP-001");
    }

    #endregion
}
