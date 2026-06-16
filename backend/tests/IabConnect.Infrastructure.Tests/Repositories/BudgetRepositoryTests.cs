using FluentAssertions;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-044 (E6-S1) AC-3/AC-5: Testcontainers-backed persistence tests for the Budget repository.
/// Verifies round-trip, the filtered unique index on the active (area, period) pair, and that a
/// soft-deleted budget is excluded by the query filter and does NOT block re-insert.
/// </summary>
public sealed class BudgetRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private BudgetRepository _repository = null!;
    private Guid _areaId;
    private Guid _periodId;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new BudgetRepository(_context);

        // FK parents (Restrict): a cost center + a fiscal period must exist.
        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var period = FiscalPeriod.Create(2026, 1, new DateTime(2026, 1, 1), new DateTime(2026, 1, 31));
        _context.ActivityAreas.Add(area);
        _context.FiscalPeriods.Add(period);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        _context.ChangeTracker.Clear();
        _areaId = area.Id;
        _periodId = period.Id;
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private Budget NewBudget(decimal amount = 1000m)
        => Budget.Create(_areaId, _periodId, amount, FinanceCurrency.CHF, "Q1", "kassier");

    [Fact]
    public async Task RoundTrip_Persists_Budget()
    {
        var ct = TestContext.Current.CancellationToken;
        var budget = NewBudget(1500m);

        await _repository.AddAsync(budget, ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByIdAsync(budget.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.Amount.Should().Be(1500m);
        loaded.Currency.Should().Be(FinanceCurrency.CHF);
        loaded.ActivityAreaId.Should().Be(_areaId);
        loaded.FiscalPeriodId.Should().Be(_periodId);
    }

    [Fact]
    public async Task UniqueIndex_Rejects_Second_Active_Budget_For_Same_Pair()
    {
        var ct = TestContext.Current.CancellationToken;
        await _repository.AddAsync(NewBudget(1000m), ct);
        _context.ChangeTracker.Clear();

        var act = async () => await _repository.AddAsync(NewBudget(2000m), ct);

        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task SoftDeleted_Budget_Is_Excluded_And_Does_Not_Block_ReInsert()
    {
        var ct = TestContext.Current.CancellationToken;
        var first = NewBudget(1000m);
        await _repository.AddAsync(first, ct);
        _context.ChangeTracker.Clear();

        await _repository.DeleteAsync(first.Id, ct);
        _context.ChangeTracker.Clear();

        // Query filter excludes the soft-deleted row.
        (await _repository.GetByIdAsync(first.Id, ct)).Should().BeNull();
        (await _repository.GetByActivityAreaAndPeriodAsync(_areaId, _periodId, ct)).Should().BeNull();

        // Re-insert for the same (area, period) pair must succeed.
        var second = NewBudget(3000m);
        var act = async () => await _repository.AddAsync(second, ct);
        await act.Should().NotThrowAsync();

        var active = await _repository.GetByActivityAreaAndPeriodAsync(_areaId, _periodId, ct);
        active.Should().NotBeNull();
        active!.Amount.Should().Be(3000m);
    }

    [Fact]
    public async Task GetByFiscalPeriod_Returns_Budgets_For_Period()
    {
        var ct = TestContext.Current.CancellationToken;
        await _repository.AddAsync(NewBudget(1000m), ct);
        _context.ChangeTracker.Clear();

        var list = await _repository.GetByFiscalPeriodAsync(_periodId, ct);
        list.Should().ContainSingle(b => b.FiscalPeriodId == _periodId);
    }
}
