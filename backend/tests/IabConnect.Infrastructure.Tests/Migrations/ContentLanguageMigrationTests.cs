using FluentAssertions;
using IabConnect.Domain.Blog;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Migrations;

/// <summary>
/// REQ-055 (E7-S4) AC-5: the AddContentLanguageMetadata migration is additive and
/// data-preserving. These tests apply the FULL migration chain (not EnsureCreated)
/// against a real PostgreSQL container, then verify: a row written without a content
/// language reads back null (pre-migration rows are unaffected) and a written value
/// round-trips, for both Event and BlogPost.
/// </summary>
public class ContentLanguageMigrationTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        // Apply the entire migration chain — proves AddContentLanguageMetadata applies clean.
        await _context.Database.MigrateAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task Event_WithoutContentLanguage_ReadsBackNull()
    {
        var evt = Event.Create("E", "Desc", "Loc", DateTime.UtcNow, DateTime.UtcNow.AddHours(1));
        _context.Set<Event>().Add(evt);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        _context.ChangeTracker.Clear();

        var loaded = await _context.Set<Event>().SingleAsync(e => e.Id == evt.Id, TestContext.Current.CancellationToken);
        loaded.ContentLanguage.Should().BeNull();
    }

    [Fact]
    public async Task Event_WithContentLanguage_RoundTrips()
    {
        var evt = Event.Create("E", "Desc", "Loc", DateTime.UtcNow, DateTime.UtcNow.AddHours(1));
        evt.SetContentLanguage("hi");
        _context.Set<Event>().Add(evt);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        _context.ChangeTracker.Clear();

        var loaded = await _context.Set<Event>().SingleAsync(e => e.Id == evt.Id, TestContext.Current.CancellationToken);
        loaded.ContentLanguage.Should().Be("hi");
    }

    [Fact]
    public async Task BlogPost_WithoutContentLanguage_ReadsBackNull()
    {
        var post = BlogPost.Create("T", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        _context.Set<BlogPost>().Add(post);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        _context.ChangeTracker.Clear();

        var loaded = await _context.Set<BlogPost>().SingleAsync(p => p.Id == post.Id, TestContext.Current.CancellationToken);
        loaded.ContentLanguage.Should().BeNull();
    }

    [Fact]
    public async Task BlogPost_WithContentLanguage_RoundTrips()
    {
        var post = BlogPost.Create("T", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        post.SetContentLanguage("de");
        _context.Set<BlogPost>().Add(post);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        _context.ChangeTracker.Clear();

        var loaded = await _context.Set<BlogPost>().SingleAsync(p => p.Id == post.Id, TestContext.Current.CancellationToken);
        loaded.ContentLanguage.Should().Be("de");
    }
}
