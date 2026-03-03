using FluentAssertions;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for ContactMessageRepository using Testcontainers
/// REQ-049: Kontaktformular + Spam-Schutz
/// </summary>
public class ContactMessageRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private ContactMessageRepository _repository = null!;

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

        _repository = new ContactMessageRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    #region AddAsync Tests

    [Fact]
    public async Task AddAsync_NewMessage_ShouldPersist()
    {
        // Arrange
        var message = CreateTestMessage();

        // Act
        await _repository.AddAsync(message, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(message.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Name.Should().Be("Max Mustermann");
        retrieved.Email.Should().Be("max@example.com");
        retrieved.Subject.Should().Be("General Inquiry");
        retrieved.Message.Should().Be("Hello, I have a question about the association.");
    }

    [Fact]
    public async Task AddAsync_NewMessage_ShouldPersistStatusAsNew()
    {
        // Arrange
        var message = CreateTestMessage();

        // Act
        await _repository.AddAsync(message, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(message.Id, TestContext.Current.CancellationToken);
        retrieved!.Status.Should().Be(ContactMessageStatus.New);
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_ExistingId_ShouldReturnMessage()
    {
        // Arrange
        var message = CreateTestMessage();
        await _repository.AddAsync(message, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByIdAsync(message.Id, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(message.Id);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistingId_ShouldReturnNull()
    {
        // Act
        var result = await _repository.GetByIdAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetAllAsync Tests

    [Fact]
    public async Task GetAllAsync_NoFilter_ShouldReturnAll()
    {
        // Arrange
        var msg1 = ContactMessage.Create("User A", "a@test.com", "Subject A", "Message A");
        var msg2 = ContactMessage.Create("User B", "b@test.com", "Subject B", "Message B");
        await _repository.AddAsync(msg1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(msg2, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(ct: TestContext.Current.CancellationToken);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAsync_WithStatusFilter_ShouldReturnFiltered()
    {
        // Arrange
        var newMsg = ContactMessage.Create("New User", "new@test.com", "New Subject", "New message");
        var readMsg = ContactMessage.Create("Read User", "read@test.com", "Read Subject", "Read message");
        readMsg.MarkAsRead(Guid.NewGuid());

        await _repository.AddAsync(newMsg, TestContext.Current.CancellationToken);
        await _repository.AddAsync(readMsg, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(ContactMessageStatus.Read, TestContext.Current.CancellationToken);

        // Assert
        result.Should().ContainSingle()
            .Which.Name.Should().Be("Read User");
    }

    [Fact]
    public async Task GetAllAsync_ShouldReturnOrderedByCreatedAtDescending()
    {
        // Arrange
        var msg1 = ContactMessage.Create("First", "first@test.com", "Subject", "Message");
        await _repository.AddAsync(msg1, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var msg2 = ContactMessage.Create("Second", "second@test.com", "Subject", "Message");
        await _repository.AddAsync(msg2, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(ct: TestContext.Current.CancellationToken);

        // Assert
        result.Should().HaveCount(2);
        result[0].Name.Should().Be("Second");
        result[1].Name.Should().Be("First");
    }

    #endregion

    #region Update Tests

    [Fact]
    public async Task Update_MarkAsResponded_ShouldPersistChanges()
    {
        // Arrange
        var message = CreateTestMessage();
        await _repository.AddAsync(message, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var userId = Guid.NewGuid();
        message.MarkAsResponded("Called the user back", userId);
        _repository.Update(message);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        _context.ChangeTracker.Clear();
        var retrieved = await _repository.GetByIdAsync(message.Id, TestContext.Current.CancellationToken);
        retrieved!.Status.Should().Be(ContactMessageStatus.Responded);
        retrieved.ResponseNotes.Should().Be("Called the user back");
        retrieved.RespondedBy.Should().Be(userId);
        retrieved.RespondedAt.Should().NotBeNull();
    }

    #endregion

    #region Remove Tests

    [Fact]
    public async Task Remove_ExistingMessage_ShouldDelete()
    {
        // Arrange
        var message = CreateTestMessage();
        await _repository.AddAsync(message, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        _repository.Remove(message);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var result = await _repository.GetByIdAsync(message.Id, TestContext.Current.CancellationToken);
        result.Should().BeNull();
    }

    #endregion

    #region Helpers

    private static ContactMessage CreateTestMessage() =>
        ContactMessage.Create(
            "Max Mustermann",
            "max@example.com",
            "General Inquiry",
            "Hello, I have a question about the association.");

    #endregion
}
