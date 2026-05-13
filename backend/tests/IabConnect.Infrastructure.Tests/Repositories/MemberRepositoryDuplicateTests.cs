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
/// REQ-018: Integration tests for <see cref="MemberRepository.FindCandidatesAsync"/>
/// against a real PostgreSQL instance via Testcontainers.
/// </summary>
public class MemberRepositoryDuplicateTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private MemberRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        _repository = new MemberRepository(_context, new DuplicateMatcher());

        await SeedAsync();
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task FindCandidatesAsync_NoSignals_ReturnsEmpty()
    {
        var result = await _repository.FindCandidatesAsync(
            emailNormalized: null,
            phoneDigits: null,
            firstNameFolded: null,
            lastNameFolded: null,
            postalCode: null,
            excludeMemberId: null,
            maxResults: 80,
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().BeEmpty();
    }

    [Fact]
    public async Task FindCandidatesAsync_ByExactEmail_CaseInsensitiveViaIlike()
    {
        var result = await _repository.FindCandidatesAsync(
            emailNormalized: "max@example.com",      // lowercased input
            phoneDigits: null,
            firstNameFolded: null,
            lastNameFolded: null,
            postalCode: null,
            excludeMemberId: null,
            maxResults: 80,
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().ContainSingle(m => m.Email == "Max@Example.COM");
    }

    [Fact]
    public async Task FindCandidatesAsync_ByPostalCode_ReturnsMembersInThatPostal()
    {
        var result = await _repository.FindCandidatesAsync(
            emailNormalized: null,
            phoneDigits: null,
            firstNameFolded: null,
            lastNameFolded: null,
            postalCode: "3011",
            excludeMemberId: null,
            maxResults: 80,
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().HaveCountGreaterThanOrEqualTo(2);
        result.Should().OnlyContain(m => m.Address.PostalCode == "3011");
    }

    [Fact]
    public async Task FindCandidatesAsync_ExcludeMemberId_FiltersOutGivenId()
    {
        var toExclude = await _context.Members.FirstAsync(m => m.Email == "Max@Example.COM", TestContext.Current.CancellationToken);

        var result = await _repository.FindCandidatesAsync(
            emailNormalized: "max@example.com",
            phoneDigits: null,
            firstNameFolded: null,
            lastNameFolded: null,
            postalCode: null,
            excludeMemberId: toExclude.Id,
            maxResults: 80,
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().NotContain(m => m.Id == toExclude.Id);
    }

    [Fact]
    public async Task FindCandidatesAsync_RespectsMaxResults()
    {
        var result = await _repository.FindCandidatesAsync(
            emailNormalized: null,
            phoneDigits: null,
            firstNameFolded: null,
            lastNameFolded: null,
            postalCode: "3011",
            excludeMemberId: null,
            maxResults: 1,
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().HaveCount(1);
    }

    [Fact]
    public async Task FindCandidatesAsync_UsesAsNoTracking_NoEntriesTracked()
    {
        _context.ChangeTracker.Clear();

        var result = await _repository.FindCandidatesAsync(
            emailNormalized: "max@example.com",
            phoneDigits: null,
            firstNameFolded: null,
            lastNameFolded: null,
            postalCode: null,
            excludeMemberId: null,
            maxResults: 80,
            cancellationToken: TestContext.Current.CancellationToken);

        result.Should().NotBeEmpty();
        _context.ChangeTracker.Entries().Should().BeEmpty();
    }

    private async Task SeedAsync()
    {
        var members = new[]
        {
            Member.Create(
                "Max",
                "Mustermann",
                "Max@Example.COM",
                Address.Create("Bundesplatz 1", "Bern", "3011", "Schweiz"),
                MembershipType.Regular,
                "+41 79 111 22 33"),
            Member.Create(
                "Anna",
                "Müller",
                "anna@example.com",
                Address.Create("Bahnhofstrasse 2", "Bern", "3011", "Schweiz"),
                MembershipType.Student,
                "0791234567"),
            Member.Create(
                "Boris",
                "Mueller",
                "boris@example.com",
                Address.Create("Bahnhofstrasse 2", "Bern", "3011", "Schweiz"),
                MembershipType.Regular,
                "0791234567"),
            Member.Create(
                "Carla",
                "Schmidt",
                "carla@example.com",
                Address.Create("Limmatquai 9", "Zürich", "8001", "Schweiz"),
                MembershipType.Regular,
                null)
        };

        foreach (var m in members)
            await _context.Members.AddAsync(m, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}
