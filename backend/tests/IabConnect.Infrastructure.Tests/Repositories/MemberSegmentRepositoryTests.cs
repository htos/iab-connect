using System.Text.Json;
using FluentAssertions;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for MemberSegmentRepository with Testcontainers
/// REQ-017: Segmentierung &amp; Verteiler
/// </summary>
public class MemberSegmentRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private MemberSegmentRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new MemberSegmentRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    #region AddAsync Tests

    [Fact]
    public async Task AddAsync_NewSegment_ShouldPersist()
    {
        var segment = MemberSegment.Create("Active Members", SegmentType.Static, "All active members", null, "orange");

        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _context.ChangeTracker.Clear();

        var retrieved = await _repository.GetByIdAsync(segment.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Name.Should().Be("Active Members");
        retrieved.SegmentType.Should().Be(SegmentType.Static);
        retrieved.Description.Should().Be("All active members");
        retrieved.Color.Should().Be("orange");
        retrieved.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task AddAsync_DynamicSegment_ShouldPersistCriteria()
    {
        var criteria = """{"status":["Active"],"type":["Regular"]}""";
        var segment = MemberSegment.Create("Dynamic Test", SegmentType.Dynamic, null, criteria);

        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _context.ChangeTracker.Clear();

        var retrieved = await _repository.GetByIdAsync(segment.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.SegmentType.Should().Be(SegmentType.Dynamic);
        // PostgreSQL may reorder JSON keys, so compare as parsed objects
        var expected = JsonSerializer.Deserialize<JsonElement>(criteria);
        var actual = JsonSerializer.Deserialize<JsonElement>(retrieved.CriteriaJson!);
        actual.ToString().Should().NotBeNullOrEmpty();
        JsonSerializer.Serialize(actual).Should().NotBeNullOrEmpty();
        foreach (var prop in expected.EnumerateObject())
        {
            actual.TryGetProperty(prop.Name, out var actualProp).Should().BeTrue();
            actualProp.ToString().Should().Be(prop.Value.ToString());
        }
    }

    #endregion

    #region GetByIdWithAssignments Tests

    [Fact]
    public async Task GetByIdWithAssignmentsAsync_ShouldIncludeAssignments()
    {
        // Create a real member first to satisfy FK constraint
        var address = Address.Create("Teststrasse 1", "Bern", "3000", "Schweiz");
        var member = Member.Create("Max", "Mustermann", "max@segment-test.com", address, MembershipType.Regular);
        _context.Members.Add(member);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var segment = MemberSegment.Create("With Members", SegmentType.Static);
        segment.AddMember(member.Id);

        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _context.ChangeTracker.Clear();

        var retrieved = await _repository.GetByIdWithAssignmentsAsync(segment.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Assignments.Should().ContainSingle()
            .Which.MemberId.Should().Be(member.Id);
    }

    #endregion

    #region GetPagedAsync Tests

    [Fact]
    public async Task GetPagedAsync_ShouldReturnPagedResults()
    {
        for (var i = 0; i < 5; i++)
        {
            var segment = MemberSegment.Create($"Segment {i}", SegmentType.Static);
            await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        }
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var (items, totalCount) = await _repository.GetPagedAsync(
            1, 3, cancellationToken: TestContext.Current.CancellationToken);

        items.Should().HaveCount(3);
        totalCount.Should().Be(5);
    }

    [Fact]
    public async Task GetPagedAsync_WithSearch_ShouldFilterByName()
    {
        await _repository.AddAsync(MemberSegment.Create("Newsletter Subscribers", SegmentType.Static), TestContext.Current.CancellationToken);
        await _repository.AddAsync(MemberSegment.Create("Active Members", SegmentType.Dynamic), TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var (items, totalCount) = await _repository.GetPagedAsync(
            1, 20, searchTerm: "Newsletter", cancellationToken: TestContext.Current.CancellationToken);

        totalCount.Should().Be(1);
        items.Should().ContainSingle().Which.Name.Should().Be("Newsletter Subscribers");
    }

    [Fact]
    public async Task GetPagedAsync_WithTypeFilter_ShouldFilterByType()
    {
        await _repository.AddAsync(MemberSegment.Create("Static One", SegmentType.Static), TestContext.Current.CancellationToken);
        await _repository.AddAsync(MemberSegment.Create("Dynamic One", SegmentType.Dynamic), TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var (items, _) = await _repository.GetPagedAsync(
            1, 20, segmentType: SegmentType.Dynamic, cancellationToken: TestContext.Current.CancellationToken);

        items.Should().ContainSingle().Which.Name.Should().Be("Dynamic One");
    }

    [Fact]
    public async Task GetPagedAsync_WithActiveFilter_ShouldFilter()
    {
        var active = MemberSegment.Create("Active", SegmentType.Static);
        var inactive = MemberSegment.Create("Inactive", SegmentType.Static);
        inactive.Deactivate();

        await _repository.AddAsync(active, TestContext.Current.CancellationToken);
        await _repository.AddAsync(inactive, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var (items, _) = await _repository.GetPagedAsync(
            1, 20, isActive: true, cancellationToken: TestContext.Current.CancellationToken);

        items.Should().ContainSingle().Which.Name.Should().Be("Active");
    }

    #endregion

    #region GetAllActiveAsync Tests

    [Fact]
    public async Task GetAllActiveAsync_ShouldOnlyReturnActive()
    {
        var active = MemberSegment.Create("Active", SegmentType.Static);
        var inactive = MemberSegment.Create("Inactive", SegmentType.Static);
        inactive.Deactivate();

        await _repository.AddAsync(active, TestContext.Current.CancellationToken);
        await _repository.AddAsync(inactive, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await _repository.GetAllActiveAsync(TestContext.Current.CancellationToken);

        result.Should().ContainSingle().Which.Name.Should().Be("Active");
    }

    #endregion

    #region Update Tests

    [Fact]
    public async Task Update_ShouldPersistChanges()
    {
        var segment = MemberSegment.Create("Original", SegmentType.Static, "Old desc", null, "orange");
        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        segment.Update("Updated", "New desc", null, "blue");
        _repository.Update(segment);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _context.ChangeTracker.Clear();

        var retrieved = await _repository.GetByIdAsync(segment.Id, TestContext.Current.CancellationToken);
        retrieved!.Name.Should().Be("Updated");
        retrieved.Description.Should().Be("New desc");
        retrieved.Color.Should().Be("blue");
    }

    #endregion

    #region Remove Tests

    [Fact]
    public async Task Remove_ShouldSoftDelete()
    {
        var segment = MemberSegment.Create("ToDelete", SegmentType.Static);
        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _repository.Remove(segment);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        _context.ChangeTracker.Clear();

        var retrieved = await _repository.GetByIdAsync(segment.Id, TestContext.Current.CancellationToken);
        retrieved.Should().BeNull();
    }

    #endregion

    #region ExistsAsync Tests

    [Fact]
    public async Task ExistsAsync_ExistingSegment_ShouldReturnTrue()
    {
        var segment = MemberSegment.Create("Existing", SegmentType.Static);
        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var exists = await _repository.ExistsAsync(segment.Id, TestContext.Current.CancellationToken);

        exists.Should().BeTrue();
    }

    [Fact]
    public async Task ExistsAsync_NonExistentSegment_ShouldReturnFalse()
    {
        var exists = await _repository.ExistsAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        exists.Should().BeFalse();
    }

    #endregion

    #region NameExistsAsync Tests

    [Fact]
    public async Task NameExistsAsync_ExistingName_ShouldReturnTrue()
    {
        await _repository.AddAsync(MemberSegment.Create("UniqueTest", SegmentType.Static), TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var exists = await _repository.NameExistsAsync("UniqueTest", cancellationToken: TestContext.Current.CancellationToken);

        exists.Should().BeTrue();
    }

    [Fact]
    public async Task NameExistsAsync_WithExcludeId_ShouldExclude()
    {
        var segment = MemberSegment.Create("Self", SegmentType.Static);
        await _repository.AddAsync(segment, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var exists = await _repository.NameExistsAsync("Self", excludeId: segment.Id, cancellationToken: TestContext.Current.CancellationToken);

        exists.Should().BeFalse();
    }

    [Fact]
    public async Task NameExistsAsync_NonExistentName_ShouldReturnFalse()
    {
        var exists = await _repository.NameExistsAsync("DoesNotExist", cancellationToken: TestContext.Current.CancellationToken);

        exists.Should().BeFalse();
    }

    #endregion
}
