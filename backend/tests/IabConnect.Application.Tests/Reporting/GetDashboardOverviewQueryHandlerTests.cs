using FluentAssertions;
using IabConnect.Application.Finance;
using IabConnect.Application.Reporting;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Reporting;

public class GetDashboardOverviewQueryHandlerTests
{
    private readonly Mock<IMemberRepository> _memberRepo = new();
    private readonly Mock<IEventRepository> _eventRepo = new();
    private readonly Mock<IEventRegistrationRepository> _registrationRepo = new();
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IInvoiceRepository> _invoiceRepo = new();
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IExpenseClaimRepository> _expenseClaimRepo = new();
    private readonly Mock<IFiscalPeriodRepository> _fiscalPeriodRepo = new();
    private readonly GetDashboardOverviewQueryHandler _handler;

    public GetDashboardOverviewQueryHandlerTests()
    {
        _handler = new GetDashboardOverviewQueryHandler(
            _memberRepo.Object,
            _eventRepo.Object,
            _registrationRepo.Object,
            _transactionRepo.Object,
            _invoiceRepo.Object,
            _paymentRepo.Object,
            _expenseClaimRepo.Object,
            _fiscalPeriodRepo.Object);
    }

    [Fact]
    public async Task Handle_WithNoData_ShouldReturnEmptyKpis()
    {
        // Arrange
        SetupEmptyRepositories();

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Members.TotalMembers.Should().Be(0);
        result.Events.TotalEvents.Should().Be(0);
        result.Finance.TotalIncome.Should().Be(0);
        result.Finance.TotalExpense.Should().Be(0);
    }

    [Fact]
    public async Task Handle_ShouldReturnCorrectMemberKpis()
    {
        // Arrange
        var members = new List<Member>
        {
            CreateMember("Alice", "Active", MembershipStatus.Active),
            CreateMember("Bob", "Pending", MembershipStatus.Pending),
            CreateMember("Charlie", "Inactive", MembershipStatus.Inactive),
            CreateMember("Diana", "Active2", MembershipStatus.Active),
            CreateMember("Eve", "Suspended", MembershipStatus.Suspended),
        };
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);
        SetupEmptyEventAndFinanceRepos();

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Members.TotalMembers.Should().Be(5);
        result.Members.ActiveMembers.Should().Be(2);
        result.Members.PendingMembers.Should().Be(1);
        result.Members.InactiveMembers.Should().Be(1);
        result.Members.SuspendedMembers.Should().Be(1);
    }

    [Fact]
    public async Task Handle_ShouldReturnCorrectEventKpis()
    {
        // Arrange
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());

        var events = new List<Event>
        {
            CreateEvent("Upcoming", DateTime.UtcNow.AddDays(7), EventStatus.Published),
            CreateEvent("Past", DateTime.UtcNow.AddDays(-7), EventStatus.Completed),
            CreateEvent("Cancelled", DateTime.UtcNow.AddDays(14), EventStatus.Cancelled),
        };
        _eventRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(events);
        _registrationRepo
            .Setup(r => r.GetStatisticsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EventRegistrationStatistics
            {
                TotalRegistrations = 5,
                ConfirmedCount = 3,
                TotalParticipants = 4
            });
        SetupEmptyFinanceRepos();

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Events.TotalEvents.Should().Be(3);
        result.Events.UpcomingEvents.Should().Be(1);
        result.Events.CompletedEvents.Should().Be(1);
        result.Events.CancelledEvents.Should().Be(1);
        result.Events.TotalRegistrations.Should().Be(15); // 5 per event x 3 events
        result.Events.TotalParticipantsConfirmed.Should().Be(12); // 4 per event x 3 events
    }

    [Fact]
    public async Task Handle_ShouldReturnCorrectFinanceKpis()
    {
        // Arrange
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());
        _eventRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Event>());

        _transactionRepo
            .Setup(r => r.GetSummaryAsync(It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((5000m, 2000m));

        var openInvoice = Invoice.Create("INV-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, Guid.NewGuid(), "Test", null, 0m, null, "admin");
        openInvoice.AddItem("Item", 1, 500m);
        var overdueInvoice = Invoice.Create("INV-002", DateTime.UtcNow.AddDays(-60), DateTime.UtcNow.AddDays(-30),
            RecipientType.Member, Guid.NewGuid(), "Test2", null, 0m, null, "admin");
        overdueInvoice.AddItem("Item", 1, 300m);
        overdueInvoice.MarkAsSent("admin");
        overdueInvoice.MarkAsOverdue("admin");

        _invoiceRepo.Setup(r => r.GetOpenItemsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice> { openInvoice, overdueInvoice });

        var payment = Payment.Create(DateTime.UtcNow, 100m, PaymentDirection.Income,
            PaymentMethod.Transfer, null, null, null, null, "admin");
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment> { payment });

        var claim = ExpenseClaim.Create("Claim", "Description", 50m, FinanceCurrency.CHF,
            DateTime.UtcNow, Guid.NewGuid(), "Claimant", null, "admin");
        _expenseClaimRepo.Setup(r => r.GetAllAsync(It.IsAny<ExpenseClaimStatus?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExpenseClaim> { claim });

        _fiscalPeriodRepo.Setup(r => r.GetByDateAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Finance.TotalIncome.Should().Be(5000m);
        result.Finance.TotalExpense.Should().Be(2000m);
        result.Finance.Balance.Should().Be(3000m);
        result.Finance.OpenInvoiceCount.Should().Be(2);
        result.Finance.OverdueInvoiceCount.Should().Be(1);
        result.Finance.PendingPaymentCount.Should().Be(1); // Draft status is not Paid/Rejected
        result.Finance.PendingExpenseClaimCount.Should().Be(1); // Draft status is not Reimbursed/Rejected
    }

    [Fact]
    public async Task Handle_WithDateRange_ShouldFilterEventsAndMembers()
    {
        // Arrange
        var from = DateTime.UtcNow.AddMonths(-3);
        var to = DateTime.UtcNow;

        var members = new List<Member>
        {
            CreateMember("Alice", "Active", MembershipStatus.Active),
        };
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);

        var insideRange = CreateEvent("Inside", DateTime.UtcNow.AddDays(-30), EventStatus.Completed);
        var outsideRange = CreateEvent("Outside", DateTime.UtcNow.AddMonths(-6), EventStatus.Completed);
        _eventRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Event> { insideRange, outsideRange });
        _registrationRepo
            .Setup(r => r.GetStatisticsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EventRegistrationStatistics { TotalRegistrations = 2, TotalParticipants = 2 });
        SetupEmptyFinanceRepos();

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(from, to), CancellationToken.None);

        // Assert
        result.Events.TotalEvents.Should().Be(1); // Only the event inside the date range
    }

    [Fact]
    public async Task Handle_ShouldReturnEventCategoryBreakdown()
    {
        // Arrange
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());

        var events = new List<Event>
        {
            CreateEvent("Event1", DateTime.UtcNow.AddDays(7), EventStatus.Published),
            CreateEvent("Event2", DateTime.UtcNow.AddDays(14), EventStatus.Published),
        };
        _eventRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(events);
        _registrationRepo
            .Setup(r => r.GetStatisticsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new EventRegistrationStatistics());
        SetupEmptyFinanceRepos();

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Events.ByCategory.Should().NotBeEmpty();
        result.Events.ByCategory.Should().Contain(c => c.Category == EventCategory.General.ToString());
    }

    [Fact]
    public async Task Handle_WithFiscalPeriod_ShouldReturnPeriodInfo()
    {
        // Arrange
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());
        _eventRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Event>());
        _transactionRepo
            .Setup(r => r.GetSummaryAsync(It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((0m, 0m));
        _invoiceRepo.Setup(r => r.GetOpenItemsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());
        _expenseClaimRepo.Setup(r => r.GetAllAsync(It.IsAny<ExpenseClaimStatus?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExpenseClaim>());

        var period = FiscalPeriod.Create(2025, 7, new DateTime(2025, 7, 1, 0, 0, 0, DateTimeKind.Utc), new DateTime(2025, 7, 31, 0, 0, 0, DateTimeKind.Utc));
        _fiscalPeriodRepo.Setup(r => r.GetByDateAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(period);

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Finance.CurrentFiscalPeriod.Should().NotBeNull();
    }

    [Fact]
    public async Task Handle_ShouldBuildMonthlyMemberTrend()
    {
        // Arrange
        var members = new List<Member>
        {
            CreateMember("Alice", "Active", MembershipStatus.Active),
            CreateMember("Bob", "Active2", MembershipStatus.Active),
        };
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(members);
        SetupEmptyEventAndFinanceRepos();

        // Act
        var result = await _handler.Handle(new GetDashboardOverviewQuery(null, null), CancellationToken.None);

        // Assert
        result.Members.MonthlyTrend.Should().NotBeEmpty();
        result.Members.MonthlyTrend.Should().AllSatisfy(t =>
        {
            t.Month.Should().MatchRegex(@"^\d{4}-\d{2}$");
        });
    }

    // --- Helper Methods ---

    private static Member CreateMember(string firstName, string lastName, MembershipStatus status)
    {
        var member = Member.Create(firstName, lastName,
            $"{firstName.ToLower()}@test.com",
            Address.Create("Street 1", "City", "1000", "CH"),
            MembershipType.Regular);
        if (status == MembershipStatus.Active) member.Activate();
        if (status == MembershipStatus.Inactive) { member.Activate(); member.Deactivate(); }
        if (status == MembershipStatus.Suspended) { member.Activate(); member.Suspend(); }
        return member;
    }

    private static Event CreateEvent(string title, DateTime startDate, EventStatus status)
    {
        var evt = Event.Create(title, "Description", "Location", startDate, startDate.AddHours(2));
        if (status == EventStatus.Published) evt.Publish();
        if (status == EventStatus.Completed) { evt.Publish(); evt.Complete(); }
        if (status == EventStatus.Cancelled) { evt.Publish(); evt.Cancel("Reason"); }
        return evt;
    }

    private void SetupEmptyRepositories()
    {
        _memberRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Member>());
        SetupEmptyEventAndFinanceRepos();
    }

    private void SetupEmptyEventAndFinanceRepos()
    {
        _eventRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Event>());
        SetupEmptyFinanceRepos();
    }

    private void SetupEmptyFinanceRepos()
    {
        _transactionRepo
            .Setup(r => r.GetSummaryAsync(It.IsAny<DateTime?>(), It.IsAny<DateTime?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((0m, 0m));
        _invoiceRepo.Setup(r => r.GetOpenItemsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Invoice>());
        _paymentRepo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Payment>());
        _expenseClaimRepo.Setup(r => r.GetAllAsync(It.IsAny<ExpenseClaimStatus?>(), It.IsAny<Guid?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<ExpenseClaim>());
        _fiscalPeriodRepo.Setup(r => r.GetByDateAsync(It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((FiscalPeriod?)null);
    }
}
