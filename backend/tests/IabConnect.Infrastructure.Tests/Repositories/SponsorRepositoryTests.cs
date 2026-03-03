using FluentAssertions;
using IabConnect.Domain.Sponsors;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for SponsorRepository using Testcontainers
/// REQ-031: Sponsorenverwaltung
/// </summary>
public class SponsorRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private SponsorRepository _repository = null!;

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

        _repository = new SponsorRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    #region AddAsync Tests

    [Fact]
    public async Task AddAsync_NewSponsor_ShouldPersist()
    {
        // Arrange
        var sponsor = CreateTestSponsor();

        // Act
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(sponsor.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.CompanyName.Should().Be("Test Corp AG");
        retrieved.Email.Should().Be("test@testcorp.ch");
    }

    [Fact]
    public async Task AddAsync_SponsorWithTier_ShouldPersistTier()
    {
        // Arrange
        var sponsor = Sponsor.Create("Gold Sponsor", null, null, null, null, null, null, null, null, SponsorTier.Gold, null, null, null);

        // Act
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(sponsor.Id, TestContext.Current.CancellationToken);
        retrieved!.Tier.Should().Be(SponsorTier.Gold);
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_ExistingId_ShouldReturnSponsor()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByIdAsync(sponsor.Id, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(sponsor.Id);
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
        var sponsor1 = Sponsor.Create("Company A", null, null, null, null, null, null, null, null, SponsorTier.Bronze, null, null, null);
        var sponsor2 = Sponsor.Create("Company B", null, null, null, null, null, null, null, null, SponsorTier.Silver, null, null, null);
        await _repository.AddAsync(sponsor1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(sponsor2, TestContext.Current.CancellationToken);
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
        var prospect = Sponsor.Create("Prospect Co", null, null, null, null, null, null, null, null, SponsorTier.Bronze, null, null, null);
        var active = Sponsor.Create("Active Co", null, null, null, null, null, null, null, null, SponsorTier.Gold, null, null, null);
        active.Activate();

        await _repository.AddAsync(prospect, TestContext.Current.CancellationToken);
        await _repository.AddAsync(active, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(SponsorStatus.Active, TestContext.Current.CancellationToken);

        // Assert
        result.Should().ContainSingle()
            .Which.CompanyName.Should().Be("Active Co");
    }

    #endregion

    #region CompanyNameExistsAsync Tests

    [Fact]
    public async Task CompanyNameExistsAsync_ExistingName_ShouldReturnTrue()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var exists = await _repository.CompanyNameExistsAsync("Test Corp AG", ct: TestContext.Current.CancellationToken);

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

    [Fact]
    public async Task CompanyNameExistsAsync_ExcludingOwnId_ShouldReturnFalse()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var exists = await _repository.CompanyNameExistsAsync("Test Corp AG", sponsor.Id, TestContext.Current.CancellationToken);

        // Assert
        exists.Should().BeFalse();
    }

    #endregion

    #region Update Tests

    [Fact]
    public async Task Update_ExistingSponsor_ShouldPersistChanges()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        sponsor.Update("Updated Name", null, "new@email.com", null, null, null, null, null, null, SponsorTier.Platinum, null, null, null);
        _repository.Update(sponsor);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        _context.ChangeTracker.Clear();
        var retrieved = await _repository.GetByIdAsync(sponsor.Id, TestContext.Current.CancellationToken);
        retrieved!.CompanyName.Should().Be("Updated Name");
        retrieved.Email.Should().Be("new@email.com");
        retrieved.Tier.Should().Be(SponsorTier.Platinum);
    }

    #endregion

    #region Delete Tests

    [Fact]
    public async Task DeleteAsync_ExistingSponsor_ShouldSoftDelete()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        await _repository.AddAsync(sponsor, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        await _repository.DeleteAsync(sponsor.Id, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert — soft delete; should not appear in normal query
        var result = await _repository.GetByIdAsync(sponsor.Id, TestContext.Current.CancellationToken);
        result.Should().BeNull();
    }

    #endregion

    #region Helpers

    private static Sponsor CreateTestSponsor() =>
        Sponsor.Create(
            "Test Corp AG",
            "Max Mustermann",
            "test@testcorp.ch",
            "+41 79 111 11 11",
            "https://testcorp.ch",
            "Teststrasse 1",
            "Bern",
            "3000",
            "Schweiz",
            SponsorTier.Silver,
            "Test notes",
            null,
            null);

    #endregion
}
