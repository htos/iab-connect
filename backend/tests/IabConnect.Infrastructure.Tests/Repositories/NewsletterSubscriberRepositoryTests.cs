using FluentAssertions;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for NewsletterSubscriberRepository using Testcontainers
/// REQ-029: Public newsletter subscribe/unsubscribe
/// </summary>
public class NewsletterSubscriberRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private NewsletterSubscriberRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18")
            .Build();

        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        _repository = new NewsletterSubscriberRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_NewSubscriber_ShouldPersist()
    {
        var subscriber = NewsletterSubscriber.Create("test@example.com", "Max", "Muster");

        await _repository.AddAsync(subscriber, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var retrieved = await _repository.GetByEmailAsync("test@example.com", TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Email.Should().Be("test@example.com");
        retrieved.FirstName.Should().Be("Max");
        retrieved.LastName.Should().Be("Muster");
        retrieved.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task GetByEmailAsync_NonExistentEmail_ShouldReturnNull()
    {
        var result = await _repository.GetByEmailAsync("nonexistent@example.com", TestContext.Current.CancellationToken);

        result.Should().BeNull();
    }

    [Fact]
    public async Task GetActiveSubscribersAsync_ShouldReturnOnlyActive()
    {
        var active1 = NewsletterSubscriber.Create("active1@example.com");
        var active2 = NewsletterSubscriber.Create("active2@example.com");
        var inactive = NewsletterSubscriber.Create("inactive@example.com");
        inactive.Unsubscribe();

        await _repository.AddAsync(active1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(active2, TestContext.Current.CancellationToken);
        await _repository.AddAsync(inactive, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var activeSubscribers = await _repository.GetActiveSubscribersAsync(TestContext.Current.CancellationToken);

        activeSubscribers.Should().HaveCount(2);
        activeSubscribers.Select(s => s.Email).Should().Contain("active1@example.com");
        activeSubscribers.Select(s => s.Email).Should().Contain("active2@example.com");
        activeSubscribers.Select(s => s.Email).Should().NotContain("inactive@example.com");
    }

    [Fact]
    public async Task UpdateAsync_ShouldPersistChanges()
    {
        var subscriber = NewsletterSubscriber.Create("update@example.com");
        await _repository.AddAsync(subscriber, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        subscriber.Unsubscribe();
        await _repository.UpdateAsync(subscriber, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var retrieved = await _repository.GetByEmailAsync("update@example.com", TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.IsActive.Should().BeFalse();
        retrieved.UnsubscribedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetByEmailAsync_ShouldBeCaseInsensitive()
    {
        var subscriber = NewsletterSubscriber.Create("CamelCase@Example.COM");
        await _repository.AddAsync(subscriber, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Email is stored lowercase by the entity
        var retrieved = await _repository.GetByEmailAsync("camelcase@example.com", TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Id.Should().Be(subscriber.Id);
    }
}
