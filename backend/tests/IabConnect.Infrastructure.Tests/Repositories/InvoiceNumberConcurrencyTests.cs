using FluentAssertions;
using IabConnect.Domain.Finance;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-071: Integration tests for concurrency-safe invoice number generation
/// using Testcontainers (real PostgreSQL).
/// </summary>
public class InvoiceNumberConcurrencyTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private DbContextOptions<ApplicationDbContext> _dbOptions = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18")
            .Build();

        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        _dbOptions = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        await using var context = new ApplicationDbContext(_dbOptions);
        await context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        // Seed a FinanceProfile so the counter can reference it
        var profile = FinanceProfile.Create(
            Jurisdiction.CH, "CH", FinanceCurrency.CHF, 1,
            "Test Org", "Street 1", "Bern", "3000", "CH",
            null, null, null, null, null, null, null);
        context.FinanceProfiles.Add(profile);
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await _postgresContainer.DisposeAsync();
    }

    private ApplicationDbContext CreateContext() => new(_dbOptions);

    [Fact]
    public async Task GetNextInvoiceNumberAsync_FirstCall_ShouldReturn0001()
    {
        // Arrange
        await using var context = CreateContext();
        var repo = new InvoiceRepository(context);

        // Act
        var number = await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);

        // Assert
        number.Should().MatchRegex(@"^INV-\d{4}-0001$");
    }

    [Fact]
    public async Task GetNextInvoiceNumberAsync_SequentialCalls_ShouldIncrement()
    {
        // Arrange
        await using var context = CreateContext();
        var repo = new InvoiceRepository(context);

        // Act
        var n1 = await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);
        var n2 = await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);
        var n3 = await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);

        // Assert — extract sequence numbers and verify ordering
        var seq1 = ExtractSequence(n1);
        var seq2 = ExtractSequence(n2);
        var seq3 = ExtractSequence(n3);

        seq2.Should().Be(seq1 + 1);
        seq3.Should().Be(seq2 + 1);
    }

    [Fact]
    public async Task GetNextInvoiceNumberAsync_ConcurrentCalls_ShouldProduceUniqueNumbers()
    {
        // Arrange — fire 20 concurrent requests using separate DbContext instances
        const int concurrency = 20;
        var results = new string[concurrency];
        var tasks = new Task[concurrency];

        for (int i = 0; i < concurrency; i++)
        {
            var index = i;
            var ct = TestContext.Current.CancellationToken;
            tasks[i] = Task.Run(async () =>
            {
                await using var ctx = CreateContext();
                var repo = new InvoiceRepository(ctx);
                results[index] = await repo.GetNextInvoiceNumberAsync(ct);
            }, ct);
        }

        // Act
        await Task.WhenAll(tasks);

        // Assert — all numbers must be unique (no duplicates)
        results.Should().OnlyHaveUniqueItems(
            "concurrent invoice number generation must never produce duplicates");

        // Extract sequences — they should be a contiguous set
        var sequences = results.Select(ExtractSequence).OrderBy(x => x).ToList();
        sequences.Should().BeInAscendingOrder();

        // Verify no gaps (contiguous)
        for (int i = 1; i < sequences.Count; i++)
        {
            sequences[i].Should().Be(sequences[i - 1] + 1,
                "sequence numbers should be contiguous (no gaps)");
        }
    }

    [Fact]
    public async Task GetNextInvoiceNumberAsync_CounterPersistsAcrossContexts()
    {
        // Arrange — get two numbers with two separate contexts
        string n1, n2;

        await using (var ctx1 = CreateContext())
        {
            var repo1 = new InvoiceRepository(ctx1);
            n1 = await repo1.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);
        }

        await using (var ctx2 = CreateContext())
        {
            var repo2 = new InvoiceRepository(ctx2);
            n2 = await repo2.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);
        }

        // Assert
        var seq1 = ExtractSequence(n1);
        var seq2 = ExtractSequence(n2);
        seq2.Should().Be(seq1 + 1);
    }

    [Fact]
    public async Task GetNextInvoiceNumberAsync_PrefixMatchesYear()
    {
        // Arrange
        await using var context = CreateContext();
        var repo = new InvoiceRepository(context);
        var expectedYear = DateTime.UtcNow.Year;

        // Act
        var number = await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);

        // Assert
        number.Should().StartWith($"INV-{expectedYear}-");
    }

    [Fact]
    public async Task InvoiceNumberCounter_PersistedInDatabase()
    {
        // Arrange
        await using var context = CreateContext();
        var repo = new InvoiceRepository(context);

        // Act
        await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);
        await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);

        // Assert — verify the counter row exists in the database
        var counters = await context.InvoiceNumberCounters
            .AsNoTracking()
            .ToListAsync(TestContext.Current.CancellationToken);

        counters.Should().HaveCount(1);
        counters[0].CurrentValue.Should().Be(2);
        counters[0].Prefix.Should().StartWith("INV-");
    }

    [Fact]
    public async Task GetNextInvoiceNumberAsync_WithExistingSeedCounter_ShouldContinue()
    {
        // Arrange — pre-seed a counter at value 42
        await using var seedCtx = CreateContext();
        var profile = await seedCtx.FinanceProfiles
            .FirstAsync(fp => fp.IsActive, TestContext.Current.CancellationToken);

        var year = DateTime.UtcNow.Year;
        var counter = InvoiceNumberCounter.Create(profile.Id, year, $"INV-{year}-");
        counter.SeedValue(42);
        seedCtx.InvoiceNumberCounters.Add(counter);
        await seedCtx.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act — next number should be 43
        await using var ctx = CreateContext();
        var repo = new InvoiceRepository(ctx);
        var number = await repo.GetNextInvoiceNumberAsync(TestContext.Current.CancellationToken);

        // Assert
        number.Should().EndWith("0043");
        ExtractSequence(number).Should().Be(43);
    }

    private static int ExtractSequence(string invoiceNumber)
    {
        // Format: "INV-YYYY-NNNN"
        var parts = invoiceNumber.Split('-');
        return int.Parse(parts[^1]);
    }
}
