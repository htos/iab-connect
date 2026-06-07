using FluentAssertions;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-044 (E6-S2) AC-1/AC-2: the actuals-bearing records (<see cref="Transaction"/> for SimpleCash,
/// <see cref="JournalEntryLine"/> for DoubleEntry) persist a nullable cost-center
/// (<see cref="ActivityArea"/>) reference, and records with <c>ActivityAreaId = null</c> round-trip
/// unchanged (backward compatibility — no backfill). This is the persistence proof for the actuals
/// dimension the S3 Soll/Ist report sums.
/// </summary>
public sealed class CostCenterAssociationPersistenceTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private Guid _areaId;
    private Guid _accountId;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        var area = ActivityArea.Create("Events", "EVT", null, null, 1);
        var account = Account.Create("Cash", "1000", AccountType.Cash, null, 1, "admin");
        _context.ActivityAreas.Add(area);
        _context.Accounts.Add(account);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        _context.ChangeTracker.Clear();
        _areaId = area.Id;
        _accountId = account.Id;
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Transaction_Persists_CostCenter()
    {
        var ct = TestContext.Current.CancellationToken;
        var tx = Transaction.Create(
            new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            "Diwali venue", 500m, TransactionType.Expense,
            _accountId, categoryId: null, reference: null, notes: null,
            createdBy: "kassier", activityAreaId: _areaId);
        _context.Transactions.Add(tx);
        await _context.SaveChangesAsync(ct);
        _context.ChangeTracker.Clear();

        var loaded = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == tx.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.ActivityAreaId.Should().Be(_areaId);
    }

    [Fact]
    public async Task Transaction_Without_CostCenter_RoundTrips()
    {
        var ct = TestContext.Current.CancellationToken;
        var tx = Transaction.Create(
            new DateTime(2026, 1, 15, 0, 0, 0, DateTimeKind.Utc),
            "Uncategorized", 50m, TransactionType.Expense,
            _accountId, categoryId: null, reference: null, notes: null,
            createdBy: "kassier", activityAreaId: null);
        _context.Transactions.Add(tx);
        await _context.SaveChangesAsync(ct);
        _context.ChangeTracker.Clear();

        var loaded = await _context.Transactions.FirstOrDefaultAsync(t => t.Id == tx.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.ActivityAreaId.Should().BeNull();
    }

    [Fact]
    public async Task JournalEntryLine_Persists_CostCenter_And_Null_SideBySide()
    {
        var ct = TestContext.Current.CancellationToken;

        var profile = FinanceProfile.Create(
            Jurisdiction.CH, "CH", FinanceCurrency.CHF, 1,
            "Verein", "Str 1", "Zürich", "8000", "CH",
            null, null, null, null, null, null, null);
        var debitAccount = LedgerAccount.Create("6000", "Expenses", LedgerAccountClass.Expense, NormalBalance.Debit, profile.Id, "admin");
        var creditAccount = LedgerAccount.Create("1000", "Cash", LedgerAccountClass.Asset, NormalBalance.Debit, profile.Id, "admin");
        _context.FinanceProfiles.Add(profile);
        _context.LedgerAccounts.AddRange(debitAccount, creditAccount);
        await _context.SaveChangesAsync(ct);

        var entry = JournalEntry.Create(
            new DateTime(2026, 1, 20, 0, 0, 0, DateTimeKind.Utc),
            "Venue booking", profile.Id, "admin");
        entry.AddLine(JournalEntryLine.Create(debitAccount.Id, debitAmount: 500m, activityAreaId: _areaId));
        entry.AddLine(JournalEntryLine.Create(creditAccount.Id, creditAmount: 500m, activityAreaId: null));
        _context.JournalEntries.Add(entry);
        await _context.SaveChangesAsync(ct);
        _context.ChangeTracker.Clear();

        var loaded = await _context.JournalEntries
            .Include(e => e.Lines)
            .FirstOrDefaultAsync(e => e.Id == entry.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.Lines.Should().HaveCount(2);
        loaded.Lines.Should().ContainSingle(l => l.ActivityAreaId == _areaId);
        loaded.Lines.Should().ContainSingle(l => l.ActivityAreaId == null);
    }
}
