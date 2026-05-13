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
/// REQ-018 (E2.S4): integration tests for the dismissal repository AND for
/// <see cref="MemberRepository.GetAllNonMergedAsync"/> against a real PostgreSQL instance.
/// </summary>
public class DuplicateCandidateDismissalRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private DuplicateCandidateDismissalRepository _repository = null!;
    private MemberRepository _memberRepository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        _repository = new DuplicateCandidateDismissalRepository(_context);
        _memberRepository = new MemberRepository(_context, new DuplicateMatcher());
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task AddAsync_PersistsRowAndUniqueIndexEnforcesOnePerPair()
    {
        var (a, b) = await CreateMemberPairAsync();
        var (canonicalSource, canonicalTarget) =
            DuplicateCandidateDismissal.Canonicalise(a.Id, b.Id);

        var first = DuplicateCandidateDismissal.Create(
            canonicalSource, canonicalTarget, Guid.NewGuid(), "First reason");
        await _repository.AddAsync(first, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var existing = await _repository.GetByCanonicalPairAsync(
            canonicalSource, canonicalTarget, TestContext.Current.CancellationToken);
        existing.Should().NotBeNull();
        existing!.Reason.Should().Be("First reason");

        // Insert a second row with the SAME canonical pair → should violate the unique index.
        var duplicate = DuplicateCandidateDismissal.Create(
            canonicalSource, canonicalTarget, Guid.NewGuid(), "Second reason");
        await _repository.AddAsync(duplicate, TestContext.Current.CancellationToken);
        await FluentActions.Awaiting(() =>
                _context.SaveChangesAsync(TestContext.Current.CancellationToken))
            .Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task GetAllPairsAsync_ReturnsCanonicalTuples()
    {
        var (a1, b1) = await CreateMemberPairAsync();
        var (a2, b2) = await CreateMemberPairAsync();
        var (s1, t1) = DuplicateCandidateDismissal.Canonicalise(a1.Id, b1.Id);
        var (s2, t2) = DuplicateCandidateDismissal.Canonicalise(a2.Id, b2.Id);

        await _repository.AddAsync(
            DuplicateCandidateDismissal.Create(s1, t1, Guid.NewGuid(), "r1"),
            TestContext.Current.CancellationToken);
        await _repository.AddAsync(
            DuplicateCandidateDismissal.Create(s2, t2, Guid.NewGuid(), "r2"),
            TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var pairs = await _repository.GetAllPairsAsync(TestContext.Current.CancellationToken);
        pairs.Should().HaveCount(2);
        pairs.Should().Contain((s1, t1));
        pairs.Should().Contain((s2, t2));
    }

    [Fact]
    public async Task GetAllNonMergedAsync_ExcludesMergedSourceRows()
    {
        var (a, b) = await CreateMemberPairAsync();
        // Mark `a` as merged into `b` so a should be filtered out.
        a.MarkMergedInto(b.Id, Guid.NewGuid());
        _memberRepository.Update(a);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var nonMerged = await _memberRepository.GetAllNonMergedAsync(
            TestContext.Current.CancellationToken);

        nonMerged.Should().Contain(m => m.Id == b.Id);
        nonMerged.Should().NotContain(m => m.Id == a.Id);
    }

    private async Task<(Member A, Member B)> CreateMemberPairAsync()
    {
        // Each Member gets its OWN Address instance — EF Core owned entities are not safe to share
        // across aggregate roots (the same instance leaks change-tracking state between members).
        var a = Member.Create(
            "Max", "Mueller",
            $"max-{Guid.NewGuid():N}@example.com",
            Address.Create("Strasse 1", "Stadt", "0000", "Schweiz"),
            MembershipType.Regular);
        var b = Member.Create(
            "Max", "Müller",
            $"max-{Guid.NewGuid():N}@example.com",
            Address.Create("Strasse 2", "Stadt", "0000", "Schweiz"),
            MembershipType.Regular);
        await _memberRepository.AddAsync(a, TestContext.Current.CancellationToken);
        await _memberRepository.AddAsync(b, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (a, b);
    }
}
