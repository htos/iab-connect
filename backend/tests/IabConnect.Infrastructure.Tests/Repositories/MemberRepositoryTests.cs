using FluentAssertions;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for MemberRepository using Testcontainers
/// </summary>
public class MemberRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private MemberRepository _repository = null!;

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

        _repository = new MemberRepository(_context, new DuplicateMatcher());
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_NewMember_ShouldPersist()
    {
        // Arrange
        var address = Address.Create("Bundesplatz 1", "Bern", "3011", "Schweiz");
        var member = Member.Create(
            "Max",
            "Mustermann",
            "max@example.com",
            address,
            MembershipType.Regular);

        // Act
        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(member.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Email.Should().Be("max@example.com");
    }

    [Fact]
    public async Task GetByEmailAsync_ExistingEmail_ShouldReturnMember()
    {
        // Arrange
        var address = Address.Create("Strasse 1", "Zürich", "8000", "Schweiz");
        var member = Member.Create(
            "Anna",
            "Schmidt",
            "anna@example.com",
            address,
            MembershipType.Student);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByEmailAsync("anna@example.com", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.FirstName.Should().Be("Anna");
    }

    [Fact]
    public async Task EmailExistsAsync_ExistingEmail_ShouldReturnTrue()
    {
        // Arrange
        var address = Address.Create("Weg 2", "Basel", "4000", "Schweiz");
        var member = Member.Create(
            "Peter",
            "Meyer",
            "peter@example.com",
            address,
            MembershipType.Regular);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var exists = await _repository.EmailExistsAsync("peter@example.com", TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeTrue();
    }

    [Fact]
    public async Task EmailExistsAsync_NonExistingEmail_ShouldReturnFalse()
    {
        // Act
        var exists = await _repository.EmailExistsAsync("nonexistent@example.com", TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task GetByIdAsync_ExistingId_ShouldReturnMember()
    {
        // Arrange
        var address = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var member = Member.Create("Test", "User", "test@example.com", address, MembershipType.Regular);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByIdAsync(member.Id, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(member.Id);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistingId_ShouldReturnNull()
    {
        // Act
        var result = await _repository.GetByIdAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task GetByKeycloakUserIdAsync_ExistingId_ShouldReturnMember()
    {
        // Arrange
        var address = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var member = Member.Create("Keycloak", "User", "keycloak@example.com", address, MembershipType.Regular);
        var keycloakId = Guid.NewGuid();
        member.LinkToKeycloak(keycloakId);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByKeycloakUserIdAsync(keycloakId, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.KeycloakUserId.Should().Be(keycloakId);
    }

    [Fact]
    public async Task GetAllAsync_ShouldReturnAllMembersOrderedByName()
    {
        // Arrange - each member needs its own Address instance (EF Core Owned Types)
        var members = new[]
        {
            Member.Create("Zara", "Adams", "zara@example.com", Address.Create("Strasse 1", "Bern", "3000", "Schweiz"), MembershipType.Regular),
            Member.Create("Anna", "Zimmermann", "anna@example.com", Address.Create("Strasse 2", "Zürich", "8000", "Schweiz"), MembershipType.Regular),
            Member.Create("Max", "Bauer", "max@example.com", Address.Create("Strasse 3", "Basel", "4000", "Schweiz"), MembershipType.Regular),
        };

        foreach (var m in members)
        {
            await _repository.AddAsync(m, TestContext.Current.CancellationToken);
        }
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Count.Should().Be(3);
        result[0].LastName.Should().Be("Adams"); // A before B before Z
        result[1].LastName.Should().Be("Bauer");
        result[2].LastName.Should().Be("Zimmermann");
    }

    [Fact]
    public async Task GetPagedAsync_ShouldReturnCorrectPage()
    {
        // Arrange - each member needs its own Address instance (EF Core Owned Types)
        for (int i = 0; i < 10; i++)
        {
            await _repository.AddAsync(
                Member.Create($"First{i}", $"Last{i}", $"user{i}@example.com",
                    Address.Create($"Strasse {i}", "Bern", "3000", "Schweiz"), MembershipType.Regular),
                TestContext.Current.CancellationToken);
        }
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var (items, totalCount) = await _repository.GetPagedAsync(
            page: 2,
            pageSize: 3,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        totalCount.Should().Be(10);
        items.Count.Should().Be(3);
    }

    [Fact]
    public async Task GetPagedAsync_WithSearchTerm_ShouldFilterResults()
    {
        // Arrange - each member needs its own Address instance (EF Core Owned Types)
        await _repository.AddAsync(
            Member.Create("Max", "Mustermann", "max@example.com", Address.Create("Strasse 1", "Bern", "3000", "Schweiz"), MembershipType.Regular),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            Member.Create("Anna", "Schmidt", "anna@example.com", Address.Create("Strasse 2", "Zürich", "8000", "Schweiz"), MembershipType.Regular),
            TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var (items, totalCount) = await _repository.GetPagedAsync(
            page: 1,
            pageSize: 10,
            searchTerm: "Max",
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        totalCount.Should().Be(1);
        items.Single().FirstName.Should().Be("Max");
    }

    [Fact]
    public async Task GetPagedAsync_WithStatusFilter_ShouldFilterResults()
    {
        // Arrange - each member needs its own Address instance (EF Core Owned Types)
        var activeMember = Member.Create("Active", "User", "active@example.com", Address.Create("Strasse 1", "Bern", "3000", "Schweiz"), MembershipType.Regular);
        activeMember.Activate();
        var pendingMember = Member.Create("Pending", "User", "pending@example.com", Address.Create("Strasse 2", "Zürich", "8000", "Schweiz"), MembershipType.Regular);

        await _repository.AddAsync(activeMember, TestContext.Current.CancellationToken);
        await _repository.AddAsync(pendingMember, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var (items, totalCount) = await _repository.GetPagedAsync(
            page: 1,
            pageSize: 10,
            status: MembershipStatus.Active,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        totalCount.Should().Be(1);
        items.Single().Status.Should().Be(MembershipStatus.Active);
    }

    [Fact]
    public async Task GetPagedAsync_WithTypeFilter_ShouldFilterResults()
    {
        // Arrange - each member needs its own Address instance (EF Core Owned Types)
        await _repository.AddAsync(
            Member.Create("Regular", "User", "regular@example.com", Address.Create("Strasse 1", "Bern", "3000", "Schweiz"), MembershipType.Regular),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            Member.Create("Student", "User", "student@example.com", Address.Create("Strasse 2", "Zürich", "8000", "Schweiz"), MembershipType.Student),
            TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var (items, totalCount) = await _repository.GetPagedAsync(
            page: 1,
            pageSize: 10,
            type: MembershipType.Student,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        totalCount.Should().Be(1);
        items.Single().MembershipType.Should().Be(MembershipType.Student);
    }

    [Fact]
    public async Task Update_ExistingMember_ShouldPersistChanges()
    {
        // Arrange
        var address = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var member = Member.Create("Original", "Name", "original@example.com", address, MembershipType.Regular);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var newAddress = Address.Create("Neue Strasse 2", "Zürich", "8000", "Schweiz");
        member.Update("Updated", "Name", "updated@example.com", newAddress, "+41 79 111 22 33");
        _repository.Update(member);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(member.Id, TestContext.Current.CancellationToken);
        retrieved!.FirstName.Should().Be("Updated");
        retrieved.Email.Should().Be("updated@example.com");
        retrieved.Address.City.Should().Be("Zürich");
    }

    [Fact]
    public async Task Remove_ExistingMember_ShouldDeleteFromDatabase()
    {
        // Arrange
        var address = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var member = Member.Create("ToDelete", "User", "delete@example.com", address, MembershipType.Regular);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var memberId = member.Id;

        // Act
        _repository.Remove(member);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var exists = await _repository.ExistsAsync(memberId, TestContext.Current.CancellationToken);
        exists.Should().BeFalse();
    }

    [Fact]
    public async Task ExistsAsync_ExistingMember_ShouldReturnTrue()
    {
        // Arrange
        var address = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var member = Member.Create("Exists", "Test", "exists@example.com", address, MembershipType.Regular);

        await _repository.AddAsync(member, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var exists = await _repository.ExistsAsync(member.Id, TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeTrue();
    }

    [Fact]
    public async Task ExistsAsync_NonExistingMember_ShouldReturnFalse()
    {
        // Act
        var exists = await _repository.ExistsAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeFalse();
    }
}
