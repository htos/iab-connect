using FluentAssertions;
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

        _repository = new MemberRepository(_context);
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
}
