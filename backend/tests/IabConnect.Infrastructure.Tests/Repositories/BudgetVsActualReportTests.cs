using FluentAssertions;
using IabConnect.Application.Finance.Budgets.Queries;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-044 (E6-S3) AC-1: the load-bearing Soll/Ist calculation proof. Wires the real
/// <see cref="GetBudgetVsActualQueryHandler"/> with real repositories against a real PostgreSQL
/// (Testcontainers) so the server-side actuals <c>GroupBy</c>, the full-outer merge, the variance
/// math, and the period/soft-delete/null exclusions are all exercised end-to-end.
/// </summary>
public sealed class BudgetVsActualReportTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private GetBudgetVsActualQueryHandler _handler = null!;

    private Guid _evtAreaId;   // budget + actual
    private Guid _mbrAreaId;   // budget only
    private Guid _admAreaId;   // actual only
    private Guid _periodId;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);
        var ct = TestContext.Current.CancellationToken;

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(ct);

        _handler = new GetBudgetVsActualQueryHandler(
            new BudgetRepository(_context),
            new TransactionRepository(_context),
            new FiscalPeriodRepository(_context),
            new ActivityAreaRepository(_context),
            new FinanceProfileRepository(_context));

        // Parents
        var evt = ActivityArea.Create("Events", "EVT", null, null, 1);
        var mbr = ActivityArea.Create("Members", "MBR", null, null, 2);
        var adm = ActivityArea.Create("Admin", "ADM", null, null, 3);
        var account = Account.Create("Cash", "1000", AccountType.Cash, null, 1, "admin");
        var period = FiscalPeriod.Create(2026, 1, new DateTime(2026, 1, 1), new DateTime(2026, 1, 31));
        var profile = FinanceProfile.Create(
            Jurisdiction.CH, "CH", FinanceCurrency.CHF, 1,
            "Verein", "Str 1", "Zürich", "8000", "CH",
            null, null, null, null, null, null, null);
        _context.ActivityAreas.AddRange(evt, mbr, adm);
        _context.Accounts.Add(account);
        _context.FiscalPeriods.Add(period);
        _context.FinanceProfiles.Add(profile);
        await _context.SaveChangesAsync(ct);

        _evtAreaId = evt.Id;
        _mbrAreaId = mbr.Id;
        _admAreaId = adm.Id;
        _periodId = period.Id;

        // Budgets (Soll): EVT 1000, MBR 500
        _context.Budgets.Add(Budget.Create(evt.Id, period.Id, 1000m, FinanceCurrency.CHF, null, "kassier"));
        _context.Budgets.Add(Budget.Create(mbr.Id, period.Id, 500m, FinanceCurrency.CHF, null, "kassier"));

        var jan = new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc);
        var feb = new DateTime(2026, 2, 15, 0, 0, 0, DateTimeKind.Utc);

        // EVT actual = 600 expense − 100 income = 500 net cost
        _context.Transactions.Add(Tx(jan, 600m, TransactionType.Expense, account.Id, evt.Id));
        _context.Transactions.Add(Tx(jan, 100m, TransactionType.Income, account.Id, evt.Id));
        // ADM actual = 300 expense (actual-only area, no budget)
        _context.Transactions.Add(Tx(jan, 300m, TransactionType.Expense, account.Id, adm.Id));
        // Excluded: outside period
        _context.Transactions.Add(Tx(feb, 999m, TransactionType.Expense, account.Id, evt.Id));
        // Excluded: null activity area
        _context.Transactions.Add(Tx(jan, 777m, TransactionType.Expense, account.Id, null));
        // Excluded: soft-deleted
        var deleted = Tx(jan, 888m, TransactionType.Expense, account.Id, evt.Id);
        deleted.SoftDelete("admin");
        _context.Transactions.Add(deleted);

        await _context.SaveChangesAsync(ct);
        _context.ChangeTracker.Clear();
    }

    private static Transaction Tx(DateTime date, decimal amount, TransactionType type, Guid accountId, Guid? areaId)
        => Transaction.Create(date, "tx", amount, type, accountId, null, null, null, "kassier", activityAreaId: areaId);

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Report_Computes_Soll_Ist_Variance_With_OuterMerge_And_Exclusions()
    {
        var ct = TestContext.Current.CancellationToken;

        var report = await _handler.Handle(new GetBudgetVsActualQuery(_periodId, null), ct);

        report.Should().NotBeNull();
        report!.FiscalPeriodName.Should().Be("2026-01");
        report.Rows.Should().HaveCount(3);

        var evt = report.Rows.Single(r => r.ActivityAreaId == _evtAreaId);
        evt.Budget.Should().Be(1000m);
        evt.Actual.Should().Be(500m); // 600 expense − 100 income (888 deleted + 999 Feb excluded)
        evt.Variance.Should().Be(500m);
        evt.VariancePercent.Should().Be(50m);

        var mbr = report.Rows.Single(r => r.ActivityAreaId == _mbrAreaId);
        mbr.Budget.Should().Be(500m);
        mbr.Actual.Should().Be(0m); // budget-only area still appears
        mbr.Variance.Should().Be(500m);
        mbr.VariancePercent.Should().Be(100m);

        var adm = report.Rows.Single(r => r.ActivityAreaId == _admAreaId);
        adm.Budget.Should().Be(0m); // actual-only area still appears
        adm.Actual.Should().Be(300m);
        adm.Variance.Should().Be(-300m);
        adm.VariancePercent.Should().Be(0m); // divide-by-zero guard: budget 0 → 0%
    }

    [Fact]
    public async Task Report_ScopedToSingleCostCenter_ReturnsOnlyThatArea()
    {
        var ct = TestContext.Current.CancellationToken;

        var report = await _handler.Handle(new GetBudgetVsActualQuery(_periodId, _evtAreaId), ct);

        report.Should().NotBeNull();
        report!.Rows.Should().ContainSingle();
        report.Rows[0].ActivityAreaId.Should().Be(_evtAreaId);
        report.Rows[0].Actual.Should().Be(500m);
    }

    [Fact]
    public async Task Report_UnknownPeriod_ReturnsNull()
    {
        var ct = TestContext.Current.CancellationToken;
        var report = await _handler.Handle(new GetBudgetVsActualQuery(Guid.NewGuid(), null), ct);
        report.Should().BeNull();
    }
}
