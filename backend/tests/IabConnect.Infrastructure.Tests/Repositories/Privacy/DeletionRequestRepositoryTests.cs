using FluentAssertions;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories.Privacy;

/// <summary>
/// Integration tests for DeletionRequestRepository using Testcontainers (REQ-012: DSGVO Art. 17)
/// </summary>
public class DeletionRequestRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private DeletionRequestRepository _repository = null!;
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

        _repository = new DeletionRequestRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_NewRequest_ShouldPersist()
    {
        // Arrange
        var request = DeletionRequest.Create(_testUserId, "test@example.com", "Delete my account");

        // Act
        await _repository.AddAsync(request, TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(request.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Email.Should().Be("test@example.com");
        retrieved.Status.Should().Be(DeletionRequestStatus.Pending);
    }

    [Fact]
    public async Task GetByUserIdAsync_MultipleRequests_ShouldReturnAll()
    {
        // Arrange
        var request1 = DeletionRequest.Create(_testUserId, "test@example.com", "First request");
        request1.Cancel();

        var request2 = DeletionRequest.Create(_testUserId, "test@example.com", "Second request");

        await _repository.AddAsync(request1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(request2, TestContext.Current.CancellationToken);

        // Act
        var results = await _repository.GetByUserIdAsync(_testUserId, TestContext.Current.CancellationToken);

        // Assert
        results.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetActiveByUserIdAsync_WithActiveRequest_ShouldReturnIt()
    {
        // Arrange
        var cancelledRequest = DeletionRequest.Create(_testUserId, "test@example.com", "Old request");
        cancelledRequest.Cancel();

        var activeRequest = DeletionRequest.Create(_testUserId, "test@example.com", "New request");

        await _repository.AddAsync(cancelledRequest, TestContext.Current.CancellationToken);
        await _repository.AddAsync(activeRequest, TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetActiveByUserIdAsync(_testUserId, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Reason.Should().Be("New request");
        result.Status.Should().Be(DeletionRequestStatus.Pending);
    }

    [Fact]
    public async Task GetActiveByUserIdAsync_NoActiveRequest_ShouldReturnNull()
    {
        // Arrange
        var completedRequest = DeletionRequest.Create(_testUserId, "test@example.com", "Done");
        completedRequest.Confirm(completedRequest.ConfirmationToken!);
        completedRequest.Complete();

        await _repository.AddAsync(completedRequest, TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetActiveByUserIdAsync(_testUserId, TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByStatusAsync_ShouldFilterByStatus()
    {
        // Arrange
        var user1 = Guid.NewGuid();
        var user2 = Guid.NewGuid();
        var user3 = Guid.NewGuid();

        var pendingRequest = DeletionRequest.Create(user1, "user1@test.com", "Pending");
        var confirmedRequest = DeletionRequest.Create(user2, "user2@test.com", "Confirmed");
        confirmedRequest.Confirm(confirmedRequest.ConfirmationToken!);
        var cancelledRequest = DeletionRequest.Create(user3, "user3@test.com", "Cancelled");
        cancelledRequest.Cancel();

        await _repository.AddAsync(pendingRequest, TestContext.Current.CancellationToken);
        await _repository.AddAsync(confirmedRequest, TestContext.Current.CancellationToken);
        await _repository.AddAsync(cancelledRequest, TestContext.Current.CancellationToken);

        // Act
        var pendingResults = await _repository.GetByStatusAsync(DeletionRequestStatus.Pending, TestContext.Current.CancellationToken);
        var confirmedResults = await _repository.GetByStatusAsync(DeletionRequestStatus.Confirmed, TestContext.Current.CancellationToken);

        // Assert
        pendingResults.Should().HaveCount(1);
        pendingResults.First().Email.Should().Be("user1@test.com");

        confirmedResults.Should().HaveCount(1);
        confirmedResults.First().Email.Should().Be("user2@test.com");
    }

    [Fact]
    public async Task GetByTokenAsync_ValidToken_ShouldReturnRequest()
    {
        // Arrange
        var request = DeletionRequest.Create(_testUserId, "test@example.com", "Test");
        var token = request.ConfirmationToken!;
        await _repository.AddAsync(request, TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByTokenAsync(token, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(request.Id);
    }

    [Fact]
    public async Task GetByTokenAsync_InvalidToken_ShouldReturnNull()
    {
        // Arrange
        var request = DeletionRequest.Create(_testUserId, "test@example.com", "Test");
        await _repository.AddAsync(request, TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByTokenAsync("invalid-token", TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task UpdateAsync_ShouldPersistStatusChanges()
    {
        // Arrange
        var request = DeletionRequest.Create(_testUserId, "test@example.com", "Test");
        await _repository.AddAsync(request, TestContext.Current.CancellationToken);

        // Act
        request.Confirm(request.ConfirmationToken!);
        await _repository.UpdateAsync(request, TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(request.Id, TestContext.Current.CancellationToken);
        retrieved!.Status.Should().Be(DeletionRequestStatus.Confirmed);
        retrieved.ConfirmedAt.Should().NotBeNull();
    }
}
