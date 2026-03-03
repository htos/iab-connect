using FluentAssertions;
using IabConnect.Domain.Sponsors;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for SupplierRepository using Testcontainers
/// REQ-032: Lieferantenverwaltung
/// </summary>
public class SupplierRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private SupplierRepository _repository = null!;

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

        _repository = new SupplierRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    #region AddAsync Tests

    [Fact]
    public async Task AddAsync_NewSupplier_ShouldPersist()
    {
        // Arrange
        var supplier = CreateTestSupplier();

        // Act
        await _repository.AddAsync(supplier, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(supplier.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.CompanyName.Should().Be("Test Catering AG");
        retrieved.Category.Should().Be("Catering");
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_ExistingId_ShouldReturnSupplier()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        await _repository.AddAsync(supplier, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByIdAsync(supplier.Id, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(supplier.Id);
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
        var supplier1 = Supplier.Create("Supplier A", null, null, null, null, null, null, null, null, "Cat A", null);
        var supplier2 = Supplier.Create("Supplier B", null, null, null, null, null, null, null, null, "Cat B", null);
        await _repository.AddAsync(supplier1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(supplier2, TestContext.Current.CancellationToken);
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
        var prospect = Supplier.Create("Prospect Supplier", null, null, null, null, null, null, null, null, null, null);
        var active = Supplier.Create("Active Supplier", null, null, null, null, null, null, null, null, null, null);
        active.Activate();

        await _repository.AddAsync(prospect, TestContext.Current.CancellationToken);
        await _repository.AddAsync(active, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(SupplierStatus.Active, TestContext.Current.CancellationToken);

        // Assert
        result.Should().ContainSingle()
            .Which.CompanyName.Should().Be("Active Supplier");
    }

    #endregion

    #region CompanyNameExistsAsync Tests

    [Fact]
    public async Task CompanyNameExistsAsync_ExistingName_ShouldReturnTrue()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        await _repository.AddAsync(supplier, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var exists = await _repository.CompanyNameExistsAsync("Test Catering AG", ct: TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeTrue();
    }

    [Fact]
    public async Task CompanyNameExistsAsync_NonExistingName_ShouldReturnFalse()
    {
        // Act
        var exists = await _repository.CompanyNameExistsAsync("NonExistent Corp", ct: TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeFalse();
    }

    #endregion

    #region Update Tests

    [Fact]
    public async Task Update_ExistingSupplier_ShouldPersistChanges()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        await _repository.AddAsync(supplier, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        supplier.Update("Updated Name", null, "new@email.com", null, null, null, null, null, null, "Dekoration", null);
        _repository.Update(supplier);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        _context.ChangeTracker.Clear();
        var retrieved = await _repository.GetByIdAsync(supplier.Id, TestContext.Current.CancellationToken);
        retrieved!.CompanyName.Should().Be("Updated Name");
        retrieved.Category.Should().Be("Dekoration");
    }

    #endregion

    #region Delete Tests

    [Fact]
    public async Task DeleteAsync_ExistingSupplier_ShouldSoftDelete()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        await _repository.AddAsync(supplier, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        await _repository.DeleteAsync(supplier.Id, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert — soft delete; should not appear in normal query
        var result = await _repository.GetByIdAsync(supplier.Id, TestContext.Current.CancellationToken);
        result.Should().BeNull();
    }

    #endregion

    #region Helpers

    private static Supplier CreateTestSupplier() =>
        Supplier.Create(
            "Test Catering AG",
            "Anna Meier",
            "anna@catering.ch",
            "+41 79 333 33 33",
            "https://catering.ch",
            "Kochstrasse 5",
            "Zürich",
            "8001",
            "Schweiz",
            "Catering",
            "Test notes");

    #endregion
}
