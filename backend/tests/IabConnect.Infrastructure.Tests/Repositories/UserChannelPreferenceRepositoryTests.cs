using FluentAssertions;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-030 (E5-S5) AC-4/AC-7: Testcontainers persistence — round-trip a preference, upsert is
/// idempotent (one row per user), and a self-scoped query returns only the caller's row.
/// </summary>
public sealed class UserChannelPreferenceRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private UserChannelPreferenceRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new UserChannelPreferenceRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task Upsert_InsertsThenUpdates_OneRowPerUser()
    {
        var ct = TestContext.Current.CancellationToken;
        var user = Guid.NewGuid();

        await _repository.UpsertAsync(UserChannelPreference.Create(user, "Sms"), ct);
        await _repository.UpsertAsync(UserChannelPreference.Create(user, "Email"), ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByUserIdAsync(user, ct);
        loaded.Should().NotBeNull();
        loaded!.PreferredChannel.Should().Be("Email", "the second upsert updates the existing row");

        var count = await _context.UserChannelPreferences.CountAsync(p => p.UserId == user, ct);
        count.Should().Be(1, "one preference row per user (unique UserId)");
    }

    [Fact]
    public async Task GetByUserId_IsSelfScoped()
    {
        var ct = TestContext.Current.CancellationToken;
        var me = Guid.NewGuid();
        var other = Guid.NewGuid();

        await _repository.UpsertAsync(UserChannelPreference.Create(me, "Email"), ct);
        await _repository.UpsertAsync(UserChannelPreference.Create(other, "Sms"), ct);
        _context.ChangeTracker.Clear();

        var mine = await _repository.GetByUserIdAsync(me, ct);
        mine!.UserId.Should().Be(me);
        mine.PreferredChannel.Should().Be("Email");
    }
}
