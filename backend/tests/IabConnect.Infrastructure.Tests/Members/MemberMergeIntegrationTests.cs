using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Members;
using IabConnect.Application.Members.Commands;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Members;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Members;

/// <summary>
/// REQ-018 (E2.S3): end-to-end integration test for <see cref="MemberMergeService"/> against
/// a real PostgreSQL instance via Testcontainers. Verifies AC-4 reference rewrites, AC-3 blocker
/// transaction-rollback semantics, AC-5 audit-row write, and AC-6 soft-retire behavior.
/// </summary>
public sealed class MemberMergeIntegrationTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private MemberRepository _memberRepository = null!;
    private MemberMergeService _mergeService = null!;
    private RecordingAuditService _auditService = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        var matcher = new DuplicateMatcher();
        _memberRepository = new MemberRepository(_context, matcher);
        _auditService = new RecordingAuditService(_context);
        _mergeService = new MemberMergeService(_context, _memberRepository, _auditService);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task MergeAsync_HappyPath_MovesAllReferencesAndSoftRetiresSource()
    {
        // Arrange: two members + a segment with both assigned + an event registration + an email recipient
        // + a draft expense claim + a draft invoice, all on the SOURCE.
        var (source, target, segmentId, eventId, campaignId) = await SeedFullHappyPathAsync();

        var command = new MergeMembersCommand(
            source.Id, target.Id,
            Reason: "Duplicate cleanup",
            ConfirmFinanceImpact: true,
            ConfirmKeycloakImpact: false,
            AdminUserId: Guid.NewGuid(),
            AdminUserName: "admin@example.com");

        // Act
        var result = await _mergeService.MergeAsync(command, TestContext.Current.CancellationToken);

        // Assert: counts
        result.SourceId.Should().Be(source.Id);
        result.TargetId.Should().Be(target.Id);
        result.MovedReferences.Should().ContainKey("MemberSegmentAssignment");
        result.MovedReferences["MemberSegmentAssignment"].Should().Be(1);
        result.MovedReferences["EventRegistration"].Should().Be(1);
        result.MovedReferences["EmailRecipient"].Should().Be(1);
        result.MovedReferences["Invoice.DraftOrCancelled"].Should().Be(1);
        result.MovedReferences["ExpenseClaim.DraftOrRejected"].Should().Be(1);

        // Assert: source is soft-retired
        _context.ChangeTracker.Clear();
        var sourceAfter = await _context.Members.AsNoTracking()
            .FirstAsync(m => m.Id == source.Id, TestContext.Current.CancellationToken);
        sourceAfter.MergedIntoMemberId.Should().Be(target.Id);
        sourceAfter.Status.Should().Be(MembershipStatus.Inactive);

        // Assert: every reference now points to the target
        var seg = await _context.Set<MemberSegmentAssignment>().AsNoTracking()
            .SingleAsync(a => a.SegmentId == segmentId, TestContext.Current.CancellationToken);
        seg.MemberId.Should().Be(target.Id);

        var reg = await _context.Set<EventRegistration>().AsNoTracking()
            .SingleAsync(r => r.EventId == eventId, TestContext.Current.CancellationToken);
        reg.MemberId.Should().Be(target.Id);

        var rec = await _context.Set<EmailRecipient>().AsNoTracking()
            .SingleAsync(r => r.CampaignId == campaignId, TestContext.Current.CancellationToken);
        rec.MemberId.Should().Be(target.Id);

        var inv = await _context.Set<Invoice>().AsNoTracking()
            .SingleAsync(i => i.RecipientType == RecipientType.Member,
                TestContext.Current.CancellationToken);
        inv.RecipientId.Should().Be(target.Id);

        var claim = await _context.Set<ExpenseClaim>().AsNoTracking()
            .SingleAsync(TestContext.Current.CancellationToken);
        claim.ClaimantId.Should().Be(target.Id);

        // Assert: exactly one audit row recorded by the service
        _auditService.LoggedEvents.Should().ContainSingle()
            .Which.EventType.Should().Be(AuditEventType.MemberMerged);
    }

    [Fact]
    public async Task MergeAsync_SentInvoiceOnSource_ThrowsUnsafeMergeException_AndRollsBack()
    {
        // Arrange
        var (source, target) = await SeedBareMembersAsync();
        var draftInvoice = Invoice.Create(
            "INV-2026-9001", DateTime.UtcNow.AddDays(-10), DateTime.UtcNow.AddDays(20),
            RecipientType.Member, source.Id, "Source Mustermann", null, 7.7m, null, "seed");
        draftInvoice.MarkAsSent("seed");
        _context.Set<Invoice>().Add(draftInvoice);

        // Add an assignment that would normally move if the merge proceeded
        var segmentId = await SeedSegmentAsync("to-be-not-moved");
        _context.Set<MemberSegmentAssignment>().Add(MemberSegmentAssignment.Create(segmentId, source.Id));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var command = new MergeMembersCommand(
            source.Id, target.Id, "Should be rejected",
            ConfirmFinanceImpact: true, ConfirmKeycloakImpact: false,
            AdminUserId: Guid.NewGuid(), AdminUserName: "admin@example.com");

        // Act
        Func<Task> act = () => _mergeService.MergeAsync(command, TestContext.Current.CancellationToken);

        // Assert: exception fires + database state UNCHANGED
        var ex = await act.Should().ThrowAsync<UnsafeMergeException>();
        ex.Which.Reasons.Should().ContainMatch("*sent/paid/overdue invoice*");

        _context.ChangeTracker.Clear();
        var seg = await _context.Set<MemberSegmentAssignment>().AsNoTracking()
            .SingleAsync(a => a.SegmentId == segmentId, TestContext.Current.CancellationToken);
        seg.MemberId.Should().Be(source.Id, "rollback should leave the assignment with the original member");

        var sourceAfter = await _context.Members.AsNoTracking()
            .SingleAsync(m => m.Id == source.Id, TestContext.Current.CancellationToken);
        sourceAfter.MergedIntoMemberId.Should().BeNull("source must NOT be retired when merge is refused");

        _auditService.LoggedEvents.Should().BeEmpty();
    }

    [Fact]
    public async Task MergeAsync_BothKeycloakLinksWithoutConfirm_ThrowsUnsafeMergeException()
    {
        var (source, target) = await SeedBareMembersAsync();
        source.LinkToKeycloak(Guid.NewGuid());
        target.LinkToKeycloak(Guid.NewGuid());
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var command = new MergeMembersCommand(
            source.Id, target.Id, "Need explicit Keycloak confirm",
            ConfirmFinanceImpact: false, ConfirmKeycloakImpact: false,
            AdminUserId: Guid.NewGuid(), AdminUserName: "admin@example.com");

        var ex = await Assert.ThrowsAsync<UnsafeMergeException>(
            () => _mergeService.MergeAsync(command, TestContext.Current.CancellationToken));
        ex.Reasons.Should().ContainMatch("*Keycloak link*");
    }

    [Fact]
    public async Task MergeAsync_KeycloakLinkOnSourceOnly_TransfersToTarget()
    {
        var (source, target) = await SeedBareMembersAsync();
        var keycloakId = Guid.NewGuid();
        source.LinkToKeycloak(keycloakId);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var command = new MergeMembersCommand(
            source.Id, target.Id, "Transfer Keycloak",
            ConfirmFinanceImpact: false, ConfirmKeycloakImpact: false,
            AdminUserId: Guid.NewGuid(), AdminUserName: "admin@example.com");

        await _mergeService.MergeAsync(command, TestContext.Current.CancellationToken);

        _context.ChangeTracker.Clear();
        var sourceAfter = await _context.Members.AsNoTracking()
            .SingleAsync(m => m.Id == source.Id, TestContext.Current.CancellationToken);
        var targetAfter = await _context.Members.AsNoTracking()
            .SingleAsync(m => m.Id == target.Id, TestContext.Current.CancellationToken);

        sourceAfter.KeycloakUserId.Should().BeNull();
        targetAfter.KeycloakUserId.Should().Be(keycloakId);
    }

    [Fact]
    public async Task MergeAsync_NonExistentSource_ThrowsKeyNotFound()
    {
        var (_, target) = await SeedBareMembersAsync();
        var command = new MergeMembersCommand(
            Guid.NewGuid(), target.Id, "phantom",
            ConfirmFinanceImpact: false, ConfirmKeycloakImpact: false,
            AdminUserId: Guid.NewGuid(), AdminUserName: "admin@example.com");

        await Assert.ThrowsAsync<KeyNotFoundException>(
            () => _mergeService.MergeAsync(command, TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task MergeAsync_SegmentDeduplicates_BeforeRewrite()
    {
        // Both source and target are assigned to the SAME segment. The pre-dedupe must delete the
        // source's row so the (SegmentId, MemberId) unique constraint doesn't reject the rewrite.
        var (source, target) = await SeedBareMembersAsync();
        var segmentId = await SeedSegmentAsync("shared-segment");

        _context.Set<MemberSegmentAssignment>().Add(MemberSegmentAssignment.Create(segmentId, source.Id));
        _context.Set<MemberSegmentAssignment>().Add(MemberSegmentAssignment.Create(segmentId, target.Id));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var command = new MergeMembersCommand(
            source.Id, target.Id, "dedupe segment",
            ConfirmFinanceImpact: false, ConfirmKeycloakImpact: false,
            AdminUserId: Guid.NewGuid(), AdminUserName: "admin@example.com");

        var result = await _mergeService.MergeAsync(command, TestContext.Current.CancellationToken);

        result.MovedReferences["MemberSegmentAssignment.PreDeduped"].Should().Be(1);
        // The source's assignment was deleted (not moved) because target already had one.
        result.MovedReferences["MemberSegmentAssignment"].Should().Be(0);

        _context.ChangeTracker.Clear();
        var remaining = await _context.Set<MemberSegmentAssignment>().AsNoTracking()
            .Where(a => a.SegmentId == segmentId)
            .ToListAsync(TestContext.Current.CancellationToken);
        remaining.Should().ContainSingle()
            .Which.MemberId.Should().Be(target.Id);
    }

    // ------------------------ Seed helpers ------------------------

    private async Task<(Member source, Member target)> SeedBareMembersAsync()
    {
        var source = NewMember("source");
        var target = NewMember("target");
        _context.Members.Add(source);
        _context.Members.Add(target);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (source, target);
    }

    private async Task<(Member source, Member target, Guid segmentId, Guid eventId, Guid campaignId)>
        SeedFullHappyPathAsync()
    {
        var (source, target) = await SeedBareMembersAsync();

        var segmentId = await SeedSegmentAsync("happy-path-segment");
        _context.Set<MemberSegmentAssignment>().Add(MemberSegmentAssignment.Create(segmentId, source.Id));

        var ev = Event.Create("Happy path event", "desc", "loc",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        _context.Set<Event>().Add(ev);

        var registration = EventRegistration.CreateForMember(
            ev.Id, Guid.NewGuid(), source.Id, "Source Mustermann", "source@example.com");
        _context.Set<EventRegistration>().Add(registration);

        var campaign = EmailCampaign.Create(
            "Test campaign", "Subject", "<p>body</p>",
            "Test", "test@example.com", Guid.NewGuid(), "seed");
        _context.Set<EmailCampaign>().Add(campaign);

        var recipient = EmailRecipient.CreateForMember(campaign.Id, source.Id,
            "source@example.com", "Source", "Mustermann");
        _context.Set<EmailRecipient>().Add(recipient);

        var draftInvoice = Invoice.Create(
            "INV-2026-9999", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, source.Id, "Source Mustermann", null, 7.7m, null, "seed");
        _context.Set<Invoice>().Add(draftInvoice);

        var draftClaim = ExpenseClaim.Create(
            "Coffee", "Team coffee", 19.50m, FinanceCurrency.CHF,
            DateTime.UtcNow, source.Id, "Source Mustermann", null, "seed");
        _context.Set<ExpenseClaim>().Add(draftClaim);

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        return (source, target, segmentId, ev.Id, campaign.Id);
    }

    private async Task<Guid> SeedSegmentAsync(string name)
    {
        var segment = MemberSegment.Create(name, SegmentType.Static, description: "test");
        _context.Set<MemberSegment>().Add(segment);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        return segment.Id;
    }

    private static Member NewMember(string tag)
    {
        return Member.Create(
            $"{tag}-first", $"{tag}-last", $"{tag}-{Guid.NewGuid()}@example.com",
            Address.Create("Street 1", "Bern", "3000", "Schweiz"),
            IabConnect.Domain.Members.MembershipType.Regular, phone: null);
    }

    /// <summary>
    /// Test stub for <see cref="IAuditService"/>: records every <c>LogAsync</c> call
    /// AND writes the AuditEvent to the DbContext so we exercise the persistence path inside
    /// the merge transaction.
    /// </summary>
    private sealed class RecordingAuditService : IAuditService
    {
        private readonly ApplicationDbContext _ctx;
        public List<AuditEvent> LoggedEvents { get; } = new();

        public RecordingAuditService(ApplicationDbContext ctx) { _ctx = ctx; }

        public async Task LogAsync(AuditEvent auditEvent, CancellationToken ct = default)
        {
            LoggedEvents.Add(auditEvent);
            await _ctx.Set<AuditEvent>().AddAsync(auditEvent, ct);
        }

        public Task LogLoginSuccessAsync(string userId, string userName, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogLoginFailureAsync(string? userName, string reason, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogMemberCreatedAsync(string memberId, string memberName, string userId, string userName, string? details = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogMemberUpdatedAsync(string memberId, string memberName, string userId, string userName, string? changes = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogMemberDeletedAsync(string memberId, string memberName, string userId, string userName, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogUserActionAsync(AuditEventType eventType, string targetUserId, string targetUserName, string actorId, string actorName, string? details = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogDataExportAsync(string exportType, string userId, string userName, int recordCount, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogActionAsync(AuditEventType eventType, string action, bool success = true, string? errorMessage = null, string? entityType = null, string? entityId = null, string? details = null, CancellationToken ct = default) => Task.CompletedTask;
    }
}
