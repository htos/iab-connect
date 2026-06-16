using FluentAssertions;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-022 (E4-S1): Testcontainers-backed persistence tests for <see cref="EventFeeCategory"/> —
/// round-trip, the filtered-unique (event_id, name) WHERE is_active index, and the
/// case-insensitive active-name check. Uses real PostgreSQL per project-context (EF InMemory is
/// not a valid proof of relational behavior).
/// </summary>
public sealed class EventFeeCategoryRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private DbContextOptions<ApplicationDbContext> _options = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        _options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        await using var seed = new ApplicationDbContext(_options);
        await seed.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();

    private async Task<Guid> SeedEventAsync()
    {
        await using var ctx = new ApplicationDbContext(_options);
        var evt = Event.Create("Workshop", "A paid workshop", "Hall",
            DateTime.UtcNow.AddDays(10), DateTime.UtcNow.AddDays(10).AddHours(3));
        ctx.Events.Add(evt);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return evt.Id;
    }

    [Fact]
    public async Task Add_And_GetByEventId_RoundTrips()
    {
        var eventId = await SeedEventAsync();
        var repo = new EventFeeCategoryRepository(new ApplicationDbContext(_options));
        var cat = EventFeeCategory.Create(eventId, "Adult", 25.50m, "CHF", FeeApplicability.Everyone, Guid.NewGuid());
        await repo.AddAsync(cat, TestContext.Current.CancellationToken);

        await using var verify = new ApplicationDbContext(_options);
        var loaded = await verify.EventFeeCategories.AsNoTracking()
            .SingleAsync(c => c.Id == cat.Id, TestContext.Current.CancellationToken);

        loaded.Name.Should().Be("Adult");
        loaded.Amount.Should().Be(25.50m);
        loaded.Currency.Should().Be("CHF");
        loaded.Applicability.Should().Be(FeeApplicability.Everyone);
        loaded.IsActive.Should().BeTrue();
        loaded.EventId.Should().Be(eventId);
    }

    [Fact]
    public async Task GetByEventId_FiltersInactive_ByDefault()
    {
        var eventId = await SeedEventAsync();
        await using var ctx = new ApplicationDbContext(_options);
        var repo = new EventFeeCategoryRepository(ctx);
        var active = EventFeeCategory.Create(eventId, "Active", 10m, "CHF", FeeApplicability.Everyone, Guid.NewGuid());
        var retired = EventFeeCategory.Create(eventId, "Retired", 10m, "CHF", FeeApplicability.Everyone, Guid.NewGuid());
        retired.Deactivate();
        await repo.AddAsync(active, TestContext.Current.CancellationToken);
        await repo.AddAsync(retired, TestContext.Current.CancellationToken);

        var activeOnly = await repo.GetByEventIdAsync(eventId, includeInactive: false, TestContext.Current.CancellationToken);
        activeOnly.Should().ContainSingle().Which.Name.Should().Be("Active");

        var all = await repo.GetByEventIdAsync(eventId, includeInactive: true, TestContext.Current.CancellationToken);
        all.Should().HaveCount(2);
    }

    [Fact]
    public async Task FilteredUniqueIndex_RejectsTwoActiveSameName_AllowsRetiredReuse()
    {
        var eventId = await SeedEventAsync();
        var repo = new EventFeeCategoryRepository(new ApplicationDbContext(_options));

        var first = EventFeeCategory.Create(eventId, "Adult", 25m, "CHF", FeeApplicability.Everyone, Guid.NewGuid());
        await repo.AddAsync(first, TestContext.Current.CancellationToken);

        // Second ACTIVE category with the same (event, name) violates the filtered-unique index.
        var dup = EventFeeCategory.Create(eventId, "Adult", 30m, "CHF", FeeApplicability.Everyone, Guid.NewGuid());
        var act = async () => await repo.AddAsync(dup, TestContext.Current.CancellationToken);
        await act.Should().ThrowAsync<DbUpdateException>();

        // Retire the first, then the name is reusable.
        await using var ctx = new ApplicationDbContext(_options);
        var retireRepo = new EventFeeCategoryRepository(ctx);
        var loaded = await retireRepo.GetByIdAsync(first.Id, TestContext.Current.CancellationToken);
        loaded!.Deactivate();
        await retireRepo.UpdateAsync(loaded, TestContext.Current.CancellationToken);

        var reused = EventFeeCategory.Create(eventId, "Adult", 30m, "CHF", FeeApplicability.Everyone, Guid.NewGuid());
        var reuseRepo = new EventFeeCategoryRepository(new ApplicationDbContext(_options));
        var reuseAct = async () => await reuseRepo.AddAsync(reused, TestContext.Current.CancellationToken);
        await reuseAct.Should().NotThrowAsync();
    }

    [Fact]
    public async Task ActiveNameExists_IsCaseInsensitive_AndIgnoresInactive()
    {
        var eventId = await SeedEventAsync();
        var repo = new EventFeeCategoryRepository(new ApplicationDbContext(_options));
        var cat = EventFeeCategory.Create(eventId, "Member", 0m, "CHF", FeeApplicability.MembersOnly, Guid.NewGuid());
        await repo.AddAsync(cat, TestContext.Current.CancellationToken);

        (await repo.ActiveNameExistsAsync(eventId, "member", null, TestContext.Current.CancellationToken))
            .Should().BeTrue("name match is case-insensitive");
        (await repo.ActiveNameExistsAsync(eventId, "Member", cat.Id, TestContext.Current.CancellationToken))
            .Should().BeFalse("the excludingId removes the category itself from the check");

        // Deactivate → no longer counts as an active-name clash.
        await using var ctx = new ApplicationDbContext(_options);
        var r2 = new EventFeeCategoryRepository(ctx);
        var loaded = await r2.GetByIdAsync(cat.Id, TestContext.Current.CancellationToken);
        loaded!.Deactivate();
        await r2.UpdateAsync(loaded, TestContext.Current.CancellationToken);

        (await repo.ActiveNameExistsAsync(eventId, "Member", null, TestContext.Current.CancellationToken))
            .Should().BeFalse("a retired category does not block the name");
    }
}
