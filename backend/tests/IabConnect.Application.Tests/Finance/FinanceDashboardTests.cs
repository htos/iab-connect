using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Dashboard;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for GetFinanceDashboardQueryHandler.
/// </summary>
public class FinanceDashboardTests
{
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IExpenseClaimRepository> _expenseClaimRepo = new();
    private readonly Mock<IFiscalPeriodRepository> _fiscalPeriodRepo = new();
    private readonly GetFinanceDashboardQueryHandler _handler;

    public FinanceDashboardTests()
    {
        _handler = new GetFinanceDashboardQueryHandler(
            _transactionRepo.Object,
            _invoiceRepo.Object,
            _paymentRepo.Object,
            _expenseClaimRepo.Object,
            _fiscalPeriodRepo.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnTransactionTotals()
    {
        // Arrange
        SetupDefaults(totalIncome: 5000m, totalExpense: 2000m);

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.TotalIncome.Should().Be(5000m);
        result.TotalExpense.Should().Be(2000m);
        result.Balance.Should().Be(3000m);
    }

    [Fact]
    public async Task Handle_ShouldReturnInvoiceStats()
    {
        // Arrange
        var sentInvoice = CreateInvoice(InvoiceStatus.Sent, 1000m);
        var overdueInvoice = CreateInvoice(InvoiceStatus.Overdue, 500m);

        SetupDefaults();
        _invoiceRepo.Setup(r => r.GetOpenItemsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice> { sentInvoice, overdueInvoice });

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.InvoicesOpenCount.Should().Be(2);
        result.InvoicesTotalOutstanding.Should().Be(1500m);
        result.InvoicesOverdueCount.Should().Be(1);
        result.InvoicesOverdueAmount.Should().Be(500m);
    }

    [Fact]
    public async Task Handle_ShouldReturnPaymentStats()
    {
        // Arrange
        var draftPayment = CreatePayment(200m, PaymentStatus.Draft);
        var submittedPayment = CreatePayment(300m, PaymentStatus.Submitted);
        var paidPayment = CreatePayment(1000m, PaymentStatus.Paid);
        var rejectedPayment = CreatePayment(150m, PaymentStatus.Rejected);

        SetupDefaults();
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { draftPayment, submittedPayment, paidPayment, rejectedPayment });

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.PaymentsTotalPending.Should().Be(500m); // 200 + 300 (draft + submitted)
        result.PaymentsTotalPaid.Should().Be(1000m);
        result.PaymentsPendingCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_ShouldReturnExpenseClaimStats()
    {
        // Arrange
        var draftClaim = CreateExpenseClaim(100m, ExpenseClaimStatus.Draft);
        var submittedClaim = CreateExpenseClaim(250m, ExpenseClaimStatus.Submitted);
        var reimbursedClaim = CreateExpenseClaim(400m, ExpenseClaimStatus.Reimbursed);
        var rejectedClaim = CreateExpenseClaim(50m, ExpenseClaimStatus.Rejected);

        SetupDefaults();
        _expenseClaimRepo.Setup(r => r.GetAllAsync(It.IsAny<ExpenseClaimStatus?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExpenseClaim> { draftClaim, submittedClaim, reimbursedClaim, rejectedClaim });

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.ExpenseClaimsTotalPending.Should().Be(350m); // 100 + 250 (draft + submitted)
        result.ExpenseClaimsTotalReimbursed.Should().Be(400m);
        result.ExpenseClaimsPendingCount.Should().Be(2);
    }

    [Fact]
    public async Task Handle_WithCurrentFiscalPeriod_ShouldReturnPeriodInfo()
    {
        // Arrange
        SetupDefaults();
        var period = FiscalPeriod.Create(2026, 2, new DateTime(2026, 2, 1, 0, 0, 0, DateTimeKind.Utc),
            new DateTime(2026, 2, 28, 23, 59, 59, DateTimeKind.Utc));

        _fiscalPeriodRepo.Setup(r => r.GetByDateAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.CurrentFiscalPeriod.Should().Be("2026-02");
        result.CurrentPeriodStatus.Should().Be("Open");
    }

    [Fact]
    public async Task Handle_WithNoFiscalPeriod_ShouldReturnNullPeriodInfo()
    {
        // Arrange
        SetupDefaults();
        _fiscalPeriodRepo.Setup(r => r.GetByDateAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.CurrentFiscalPeriod.Should().BeNull();
        result.CurrentPeriodStatus.Should().BeNull();
    }

    [Fact]
    public async Task Handle_WithEmptyData_ShouldReturnZeroValues()
    {
        // Arrange
        SetupDefaults();

        // Act
        var result = await _handler.Handle(new GetFinanceDashboardQuery(), CancellationToken.None);

        // Assert
        result.TotalIncome.Should().Be(0m);
        result.TotalExpense.Should().Be(0m);
        result.Balance.Should().Be(0m);
        result.InvoicesTotalOutstanding.Should().Be(0m);
        result.InvoicesOverdueCount.Should().Be(0);
        result.InvoicesOpenCount.Should().Be(0);
        result.PaymentsTotalPending.Should().Be(0m);
        result.PaymentsTotalPaid.Should().Be(0m);
        result.PaymentsPendingCount.Should().Be(0);
        result.ExpenseClaimsTotalPending.Should().Be(0m);
        result.ExpenseClaimsTotalReimbursed.Should().Be(0m);
        result.ExpenseClaimsPendingCount.Should().Be(0);
    }

    #region Helpers

    private void SetupDefaults(decimal totalIncome = 0m, decimal totalExpense = 0m)
    {
        _transactionRepo.Setup(r => r.GetSummaryAsync(
                It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((totalIncome, totalExpense));

        _invoiceRepo.Setup(r => r.GetOpenItemsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());

        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());

        _expenseClaimRepo.Setup(r => r.GetAllAsync(It.IsAny<ExpenseClaimStatus?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExpenseClaim>());

        _fiscalPeriodRepo.Setup(r => r.GetByDateAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);
    }

    private static Invoice CreateInvoice(InvoiceStatus status, decimal total)
    {
        var invoice = Invoice.Create(
            $"INV-{Guid.NewGuid():N}"[..10],
            DateTime.UtcNow.AddDays(-30),
            DateTime.UtcNow.AddDays(-10),
            RecipientType.Member,
            Guid.NewGuid(),
            "Test Recipient",
            null,
            0m,
            null,
            "admin");

        // Use reflection to set Status and Total since they are private set
        typeof(Invoice).GetProperty("Status")!.SetValue(invoice, status);
        typeof(Invoice).GetProperty("Total")!.SetValue(invoice, total);

        return invoice;
    }

    private static Payment CreatePayment(decimal amount, PaymentStatus status)
    {
        var payment = Payment.Create(
            DateTime.UtcNow, amount, PaymentDirection.Expense, PaymentMethod.Transfer, null,
            null, null, null, "admin");

        // Use reflection to set Status since it's private set
        typeof(Payment).GetProperty("Status")!.SetValue(payment, status);

        return payment;
    }

    private static ExpenseClaim CreateExpenseClaim(decimal amount, ExpenseClaimStatus status)
    {
        var claim = ExpenseClaim.Create(
            "Test Claim", "Description", amount, FinanceCurrency.CHF,
            DateTime.UtcNow, Guid.NewGuid(), "Test User", null, "admin");

        // Use reflection to set Status since it's private set
        typeof(ExpenseClaim).GetProperty("Status")!.SetValue(claim, status);

        return claim;
    }

    #endregion
}
