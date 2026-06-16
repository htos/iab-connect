using FluentAssertions;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Communication;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-028 (E5-S1) AC-7/AC-8: Testcontainers-backed persistence + recipient-resolution tests.
/// Round-trips an <see cref="AutomationDefinition"/> (incl. owned trigger + recipient rule) through
/// the repository, exercises the paged-list filter, and verifies the shared
/// <see cref="RecipientResolutionService"/> resolves a segment + consent filter to the expected
/// member set.
/// </summary>
public sealed class AutomationDefinitionRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private AutomationDefinitionRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new AutomationDefinitionRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private static AutomationDefinition NewDefinition(
        string name = "Welcome",
        AutomationTriggerType type = AutomationTriggerType.EventUpcoming,
        int? offset = 7,
        RecipientSegmentType segment = RecipientSegmentType.AllActiveMembers,
        ConsentType? consent = null)
        => AutomationDefinition.Create(
            name, "desc", templateId: 1,
            AutomationTrigger.Create(type, offset),
            segment, segmentFilter: null, consentFilter: consent,
            createdById: Guid.NewGuid(), createdByName: "tester");

    [Fact]
    public async Task RoundTrip_PersistsTriggerAndRecipientRule()
    {
        var ct = TestContext.Current.CancellationToken;
        var def = NewDefinition(consent: ConsentType.Newsletter);

        await _repository.AddAsync(def, ct);
        _context.ChangeTracker.Clear();

        var loaded = await _repository.GetByIdAsync(def.Id, ct);
        loaded.Should().NotBeNull();
        loaded!.Name.Should().Be("Welcome");
        loaded.Trigger.Type.Should().Be(AutomationTriggerType.EventUpcoming);
        loaded.Trigger.OffsetDays.Should().Be(7);
        loaded.SegmentType.Should().Be(RecipientSegmentType.AllActiveMembers);
        loaded.ConsentFilter.Should().Be(ConsentType.Newsletter);
        loaded.Status.Should().Be(AutomationStatus.Draft);
    }

    [Fact]
    public async Task PagedList_FiltersByStatus()
    {
        var ct = TestContext.Current.CancellationToken;
        var active = NewDefinition("Active one");
        active.Activate();
        await _repository.AddAsync(active, ct);
        await _repository.AddAsync(NewDefinition("Draft one"), ct);
        _context.ChangeTracker.Clear();

        var (items, total) = await _repository.GetAllAsync(
            new AutomationDefinitionFilterOptions { Status = AutomationStatus.Active }, 1, 20, ct);

        total.Should().Be(1);
        items.Should().ContainSingle(d => d.Name == "Active one");
    }

    [Fact]
    public async Task GetActive_ReturnsOnlyActive()
    {
        var ct = TestContext.Current.CancellationToken;
        var a = NewDefinition("A"); a.Activate();
        var b = NewDefinition("B"); b.Activate(); b.Pause();
        await _repository.AddAsync(a, ct);
        await _repository.AddAsync(b, ct);
        await _repository.AddAsync(NewDefinition("C"), ct); // Draft
        _context.ChangeTracker.Clear();

        var active = await _repository.GetActiveAsync(ct);
        active.Should().ContainSingle(d => d.Name == "A");
    }

    [Fact]
    public async Task Resolver_AppliesConsentFilter()
    {
        var ct = TestContext.Current.CancellationToken;

        // Two active members; only one has Newsletter consent.
        var consentedUser = Guid.NewGuid();
        var m1 = ActiveMember("Asha", "a@example.com", consentedUser);
        var m2 = ActiveMember("Ben", "b@example.com", Guid.NewGuid());
        _context.Members.AddRange(m1, m2);
        _context.Consents.Add(Consent.Grant(consentedUser, ConsentType.Newsletter, "v1"));
        await _context.SaveChangesAsync(ct);
        _context.ChangeTracker.Clear();

        var resolver = new RecipientResolutionService(
            _context,
            new MemberSegmentRepository(_context),
            new ConsentRepository(_context));

        var all = await resolver.ResolveAsync(RecipientSegmentType.AllActiveMembers, null, null, ct);
        all.Should().HaveCount(2);

        var consented = await resolver.ResolveAsync(
            RecipientSegmentType.AllActiveMembers, null, ConsentType.Newsletter, ct);
        consented.Should().ContainSingle(r => r.Email == "a@example.com");
    }

    [Fact]
    public async Task Resolver_MemberSegment_ResolvesStaticAssignments()
    {
        var ct = TestContext.Current.CancellationToken;

        var m1 = ActiveMember("Asha", "a@example.com", Guid.NewGuid());
        var m2 = ActiveMember("Ben", "b@example.com", Guid.NewGuid());
        _context.Members.AddRange(m1, m2);

        var segment = MemberSegment.Create("VIPs", SegmentType.Static, "desc", null, "orange");
        segment.AddMember(m1.Id);
        _context.MemberSegments.Add(segment);
        await _context.SaveChangesAsync(ct);
        _context.ChangeTracker.Clear();

        var resolver = new RecipientResolutionService(
            _context,
            new MemberSegmentRepository(_context),
            new ConsentRepository(_context));

        var result = await resolver.ResolveAsync(
            RecipientSegmentType.MemberSegment, segment.Id.ToString(), null, ct);

        result.Should().ContainSingle(r => r.Email == "a@example.com");
    }

    private static Member ActiveMember(string firstName, string email, Guid keycloakUserId)
    {
        var member = Member.Create(
            firstName, "Tester", email,
            Address.Create("Street 1", "City", "1000", "Country"),
            MembershipType.Regular);
        member.Activate();
        member.LinkToKeycloak(keycloakUserId);
        return member;
    }
}
