using FluentAssertions;
using IabConnect.Domain.Audit;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for AuditEventRepository using Testcontainers (REQ-011)
/// </summary>
public class AuditEventRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private AuditEventRepository _repository = null!;

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

        _repository = new AuditEventRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    #region AddAsync Tests

    [Fact]
    public async Task AddAsync_NewAuditEvent_ShouldPersist()
    {
        // Arrange
        var auditEvent = AuditEvent.LoginSuccess("user-123", "max@example.com", "192.168.1.1");

        // Act
        await _repository.AddAsync(auditEvent, TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _context.AuditEvents.FirstOrDefaultAsync(
            e => e.Id == auditEvent.Id,
            TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.UserId.Should().Be("user-123");
        retrieved.UserName.Should().Be("max@example.com");
    }

    #endregion

    #region GetAsync Tests - Basic

    [Fact]
    public async Task GetAsync_WithNoFilter_ShouldReturnAllEvents()
    {
        // Arrange
        await SeedTestDataAsync();

        // Act
        var (items, totalCount) = await _repository.GetAsync(
            new AuditEventFilter(),
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        totalCount.Should().BeGreaterThanOrEqualTo(5);
        items.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetAsync_ShouldReturnOrderedByTimestampDescending()
    {
        // Arrange - add events with delays to ensure different timestamps
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-1", "user1@example.com", "192.168.1.1"),
            TestContext.Current.CancellationToken);
        await Task.Delay(20, TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-2", "user2@example.com", "192.168.1.2"),
            TestContext.Current.CancellationToken);
        await Task.Delay(20, TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-3", "user3@example.com", "192.168.1.3"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter(),
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert - should be ordered descending (newest first)
        items.Count.Should().BeGreaterThanOrEqualTo(3);
        // Verify the most recent is first (user-3)
        items[0].UserId.Should().Be("user-3");
    }

    [Fact]
    public async Task GetAsync_WithPagination_ShouldReturnCorrectPage()
    {
        // Arrange
        for (int i = 0; i < 10; i++)
        {
            await _repository.AddAsync(
                AuditEvent.LoginSuccess($"user-{i}", $"user{i}@example.com"),
                TestContext.Current.CancellationToken);
        }

        // Act
        var (items, totalCount) = await _repository.GetAsync(
            new AuditEventFilter(),
            page: 2,
            pageSize: 3,
            TestContext.Current.CancellationToken);

        // Assert
        totalCount.Should().Be(10);
        items.Count.Should().Be(3);
    }

    #endregion

    #region GetAsync Tests - Filters

    [Fact]
    public async Task GetAsync_FilterByEventType_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-1", "user1@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginFailure("user2@example.com", "Invalid password"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { EventType = AuditEventType.LoginSuccess },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e => e.EventType.Should().Be(AuditEventType.LoginSuccess));
    }

    [Fact]
    public async Task GetAsync_FilterByCategory_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-1", "user1@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-1", "Max Mustermann", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { Category = AuditCategory.Authentication },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e => e.Category.Should().Be(AuditCategory.Authentication));
    }

    [Fact]
    public async Task GetAsync_FilterByUserId_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-specific", "specific@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-other", "other@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { UserId = "user-specific" },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e => e.UserId.Should().Be("user-specific"));
    }

    [Fact]
    public async Task GetAsync_FilterBySeverity_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-1", "user1@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginFailure("user2@example.com", "Error"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { Severity = AuditSeverity.Warning },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e => e.Severity.Should().Be(AuditSeverity.Warning));
    }

    [Fact]
    public async Task GetAsync_FilterBySuccess_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-1", "user1@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginFailure("user2@example.com", "Error"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { Success = false },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e => e.Success.Should().BeFalse());
    }

    [Fact]
    public async Task GetAsync_FilterByDateRange_ShouldReturnMatchingEvents()
    {
        // Arrange
        await SeedTestDataAsync();
        var fromDate = DateTime.UtcNow.AddMinutes(-5);
        var toDate = DateTime.UtcNow.AddMinutes(5);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { FromDate = fromDate, ToDate = toDate },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e =>
        {
            e.Timestamp.Should().BeOnOrAfter(fromDate);
            e.Timestamp.Should().BeOnOrBefore(toDate);
        });
    }

    [Fact]
    public async Task GetAsync_FilterBySearchTerm_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-1", "Max Mustermann", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-2", "Anna Schmidt", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { SearchTerm = "Max" },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().ContainSingle();
        items[0].Action.Should().Contain("Max");
    }

    [Fact]
    public async Task GetAsync_FilterByEntityType_ShouldReturnMatchingEvents()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-1", "Max", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var (items, _) = await _repository.GetAsync(
            new AuditEventFilter { EntityType = "Member" },
            1,
            50,
            TestContext.Current.CancellationToken);

        // Assert
        items.Should().AllSatisfy(e => e.EntityType.Should().Be("Member"));
    }

    #endregion

    #region GetByEntityAsync Tests

    [Fact]
    public async Task GetByEntityAsync_ShouldReturnEventsForSpecificEntity()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-specific", "Max", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.MemberUpdated("member-specific", "Max Updated", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-other", "Other", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var events = await _repository.GetByEntityAsync(
            "Member",
            "member-specific",
            TestContext.Current.CancellationToken);

        // Assert
        events.Count.Should().Be(2);
        events.Should().AllSatisfy(e =>
        {
            e.EntityType.Should().Be("Member");
            e.EntityId.Should().Be("member-specific");
        });
    }

    [Fact]
    public async Task GetByEntityAsync_ShouldReturnOrderedByTimestampDescending()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.MemberCreated("member-1", "Max", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);
        await Task.Delay(10, TestContext.Current.CancellationToken); // Ensure different timestamps
        await _repository.AddAsync(
            AuditEvent.MemberUpdated("member-1", "Max Updated", "user-1", "admin@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var events = await _repository.GetByEntityAsync(
            "Member",
            "member-1",
            TestContext.Current.CancellationToken);

        // Assert
        events.Should().BeInDescendingOrder(e => e.Timestamp);
    }

    [Fact]
    public async Task GetByEntityAsync_ShouldLimitTo100()
    {
        // Arrange - Add 105 events
        for (int i = 0; i < 105; i++)
        {
            await _repository.AddAsync(
                AuditEvent.MemberUpdated("member-many", $"Update {i}", "user-1", "admin@example.com"),
                TestContext.Current.CancellationToken);
        }

        // Act
        var events = await _repository.GetByEntityAsync(
            "Member",
            "member-many",
            TestContext.Current.CancellationToken);

        // Assert
        events.Count.Should().Be(100);
    }

    #endregion

    #region GetByUserAsync Tests

    [Fact]
    public async Task GetByUserAsync_ShouldReturnEventsForSpecificUser()
    {
        // Arrange
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-target", "target@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-target", "target@example.com"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            AuditEvent.LoginSuccess("user-other", "other@example.com"),
            TestContext.Current.CancellationToken);

        // Act
        var events = await _repository.GetByUserAsync(
            "user-target",
            100,
            TestContext.Current.CancellationToken);

        // Assert
        events.Count.Should().Be(2);
        events.Should().AllSatisfy(e => e.UserId.Should().Be("user-target"));
    }

    [Fact]
    public async Task GetByUserAsync_ShouldRespectLimit()
    {
        // Arrange
        for (int i = 0; i < 10; i++)
        {
            await _repository.AddAsync(
                AuditEvent.LoginSuccess("user-limit", "limit@example.com"),
                TestContext.Current.CancellationToken);
        }

        // Act
        var events = await _repository.GetByUserAsync(
            "user-limit",
            limit: 5,
            TestContext.Current.CancellationToken);

        // Assert
        events.Count.Should().Be(5);
    }

    [Fact]
    public async Task GetByUserAsync_NoEvents_ShouldReturnEmptyList()
    {
        // Act
        var events = await _repository.GetByUserAsync(
            "non-existent-user",
            100,
            TestContext.Current.CancellationToken);

        // Assert
        events.Should().BeEmpty();
    }

    #endregion

    #region Helper Methods

    private async Task SeedTestDataAsync()
    {
        var events = new[]
        {
            AuditEvent.LoginSuccess("user-1", "user1@example.com", "192.168.1.1"),
            AuditEvent.LoginSuccess("user-2", "user2@example.com", "192.168.1.2"),
            AuditEvent.LoginFailure("user3@example.com", "Invalid password"),
            AuditEvent.MemberCreated("member-1", "Max Mustermann", "user-1", "admin@example.com"),
            AuditEvent.MemberUpdated("member-1", "Max Mustermann Updated", "user-1", "admin@example.com"),
        };

        foreach (var e in events)
        {
            await _repository.AddAsync(e, TestContext.Current.CancellationToken);
        }
    }

    #endregion
}
