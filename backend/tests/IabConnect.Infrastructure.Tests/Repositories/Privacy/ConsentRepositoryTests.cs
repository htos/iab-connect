using FluentAssertions;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories.Privacy;

/// <summary>
/// Integration tests for ConsentRepository using Testcontainers (REQ-012: DSGVO)
/// </summary>
public class ConsentRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private ConsentRepository _repository = null!;
    private readonly Guid _testUserId = Guid.NewGuid();

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

        _repository = new ConsentRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_NewConsent_ShouldPersist()
    {
        // Arrange
        var consent = Consent.Grant(_testUserId, ConsentType.Newsletter, "1.0.0", "127.0.0.1", "Test Agent");

        // Act
        await _repository.AddAsync(consent, TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByUserAndTypeAsync(_testUserId, ConsentType.Newsletter, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.IsGranted.Should().BeTrue();
    }

    [Fact]
    public async Task GetByUserIdAsync_MultipleConsents_ShouldReturnAll()
    {
        // Arrange
        var consent1 = Consent.Grant(_testUserId, ConsentType.Newsletter, "1.0.0", "127.0.0.1", "Test");
        var consent2 = Consent.Grant(_testUserId, ConsentType.Marketing, "1.0.0", "127.0.0.1", "Test");

        await _repository.AddAsync(consent1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(consent2, TestContext.Current.CancellationToken);

        // Act
        var results = await _repository.GetByUserIdAsync(_testUserId, TestContext.Current.CancellationToken);

        // Assert
        results.Should().HaveCount(2);
        results.Should().Contain(c => c.Type == ConsentType.Newsletter);
        results.Should().Contain(c => c.Type == ConsentType.Marketing);
    }

    [Fact]
    public async Task HasConsentAsync_GrantedConsent_ShouldReturnTrue()
    {
        // Arrange
        var consent = Consent.Grant(_testUserId, ConsentType.EventNotifications, "1.0.0", "127.0.0.1", "Test");
        await _repository.AddAsync(consent, TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.HasConsentAsync(_testUserId, ConsentType.EventNotifications, TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public async Task HasConsentAsync_RevokedConsent_ShouldReturnFalse()
    {
        // Arrange
        var consent = Consent.Grant(_testUserId, ConsentType.PhotoUsage, "1.0.0", "127.0.0.1", "Test");
        consent.Revoke();
        await _repository.AddAsync(consent, TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.HasConsentAsync(_testUserId, ConsentType.PhotoUsage, TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task HasConsentAsync_NoConsent_ShouldReturnFalse()
    {
        // Act
        var result = await _repository.HasConsentAsync(Guid.NewGuid(), ConsentType.Newsletter, TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateAsync_ExistingConsent_ShouldPersistChanges()
    {
        // Arrange
        var consent = Consent.Grant(_testUserId, ConsentType.Marketing, "1.0.0", "127.0.0.1", "Test");
        await _repository.AddAsync(consent, TestContext.Current.CancellationToken);

        // Act
        consent.Revoke();
        await _repository.UpdateAsync(consent, TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByUserAndTypeAsync(_testUserId, ConsentType.Marketing, TestContext.Current.CancellationToken);
        retrieved!.IsGranted.Should().BeFalse();
        retrieved.RevokedAt.Should().NotBeNull();
    }

    [Fact]
    public async Task GetUsersWithConsentAsync_ShouldReturnOnlyUsersWithGrantedConsent()
    {
        // Arrange
        var user1 = Guid.NewGuid();
        var user2 = Guid.NewGuid();
        var user3 = Guid.NewGuid();

        var consent1 = Consent.Grant(user1, ConsentType.Newsletter, "1.0.0", "127.0.0.1", "Test");
        var consent2 = Consent.Grant(user2, ConsentType.Newsletter, "1.0.0", "127.0.0.1", "Test");
        var consent3 = Consent.Grant(user3, ConsentType.Newsletter, "1.0.0", "127.0.0.1", "Test");
        consent3.Revoke(); // User 3 revoked

        await _repository.AddAsync(consent1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(consent2, TestContext.Current.CancellationToken);
        await _repository.AddAsync(consent3, TestContext.Current.CancellationToken);

        // Act
        var usersWithConsent = await _repository.GetUsersWithConsentAsync(ConsentType.Newsletter, TestContext.Current.CancellationToken);

        // Assert
        usersWithConsent.Should().HaveCount(2);
        usersWithConsent.Should().Contain(user1);
        usersWithConsent.Should().Contain(user2);
        usersWithConsent.Should().NotContain(user3);
    }
}
