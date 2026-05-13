using FluentAssertions;
using IabConnect.Application.Events.Volunteers;
using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Events.Volunteers;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-024 (E3.S3) AC-10 + action item A6: capacity-bounded concurrency race test.
/// Two tasks call <c>SelfSignUp</c> for the same one-slot shift simultaneously; the
/// FOR UPDATE shift-row lock + partial unique index must produce exactly one
/// <see cref="VolunteerAssignmentOutcome.Confirmed"/> and one <c>Waitlisted</c>
/// (or <c>ShiftFull</c> when waitlist is disabled).
/// </summary>
public sealed class EventVolunteerAssignmentConcurrencyTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private DbContextOptions<ApplicationDbContext> _options = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);
        _options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;
        await using var seed = new ApplicationDbContext(_options);
        await seed.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
    }

    public async ValueTask DisposeAsync() => await _postgres.DisposeAsync();

    [Fact]
    public async Task TwoMembersRacingSelfSignUp_WithCapacity1AndWaitlist_OneConfirmedOneWaitlisted()
    {
        var (eventId, _, shiftId, memberA, memberB) = await SeedShiftAndTwoMembersAsync(capacity: 1, allowWaitlist: true);

        await using var ctxA = new ApplicationDbContext(_options);
        await using var ctxB = new ApplicationDbContext(_options);

        var serviceA = new EventVolunteerAssignmentService(ctxA, new EventVolunteerAssignmentRepository(ctxA));
        var serviceB = new EventVolunteerAssignmentService(ctxB, new EventVolunteerAssignmentRepository(ctxB));

        var taskA = Task.Run(() => serviceA.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: true, isSelfSignup: true, TestContext.Current.CancellationToken));
        var taskB = Task.Run(() => serviceB.AssignAsync(eventId, shiftId, memberB, memberB, allowWaitlistFallback: true, isSelfSignup: true, TestContext.Current.CancellationToken));

        var results = await Task.WhenAll(taskA, taskB);

        results.Count(r => r.Outcome == VolunteerAssignmentOutcome.Confirmed).Should().Be(1);
        results.Count(r => r.Outcome == VolunteerAssignmentOutcome.Waitlisted).Should().Be(1);

        await using var verify = new ApplicationDbContext(_options);
        var rows = await verify.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Count.Should().Be(2);
        rows.Count(r => r.Status == VolunteerAssignmentStatus.Confirmed).Should().Be(1);
        rows.Count(r => r.Status == VolunteerAssignmentStatus.Waitlisted).Should().Be(1);
    }

    [Fact]
    public async Task TwoMembersRacingSelfSignUp_WithCapacity1AndNoWaitlist_OneConfirmedOneShiftFull()
    {
        var (eventId, _, shiftId, memberA, memberB) = await SeedShiftAndTwoMembersAsync(capacity: 1, allowWaitlist: false);

        await using var ctxA = new ApplicationDbContext(_options);
        await using var ctxB = new ApplicationDbContext(_options);
        var serviceA = new EventVolunteerAssignmentService(ctxA, new EventVolunteerAssignmentRepository(ctxA));
        var serviceB = new EventVolunteerAssignmentService(ctxB, new EventVolunteerAssignmentRepository(ctxB));

        var taskA = Task.Run(() => serviceA.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: false, isSelfSignup: true, TestContext.Current.CancellationToken));
        var taskB = Task.Run(() => serviceB.AssignAsync(eventId, shiftId, memberB, memberB, allowWaitlistFallback: false, isSelfSignup: true, TestContext.Current.CancellationToken));

        var results = await Task.WhenAll(taskA, taskB);

        results.Count(r => r.Outcome == VolunteerAssignmentOutcome.Confirmed).Should().Be(1);
        results.Count(r => r.Outcome == VolunteerAssignmentOutcome.ShiftFull).Should().Be(1);

        await using var verify = new ApplicationDbContext(_options);
        var rows = await verify.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Count.Should().Be(1);
    }

    [Fact]
    public async Task SameMemberRacingSelfSignUp_ProducesExactlyOneRow()
    {
        var (eventId, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 2, allowWaitlist: true);

        await using var ctxA = new ApplicationDbContext(_options);
        await using var ctxB = new ApplicationDbContext(_options);
        var serviceA = new EventVolunteerAssignmentService(ctxA, new EventVolunteerAssignmentRepository(ctxA));
        var serviceB = new EventVolunteerAssignmentService(ctxB, new EventVolunteerAssignmentRepository(ctxB));

        var taskA = Task.Run(() => serviceA.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: true, isSelfSignup: true, TestContext.Current.CancellationToken));
        var taskB = Task.Run(() => serviceB.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: true, isSelfSignup: true, TestContext.Current.CancellationToken));

        var results = await Task.WhenAll(taskA, taskB);

        // Both succeed but one must be the existing-row idempotent return (AlreadyAssigned).
        var newCount = results.Count(r => r.Outcome == VolunteerAssignmentOutcome.Confirmed
                                       || r.Outcome == VolunteerAssignmentOutcome.Waitlisted);
        newCount.Should().Be(1);
        results.Count(r => r.Outcome == VolunteerAssignmentOutcome.AlreadyAssigned).Should().Be(1);

        await using var verify = new ApplicationDbContext(_options);
        var rows = await verify.EventVolunteerAssignments
            .Where(a => a.ShiftId == shiftId && a.MemberId == memberA)
            .ToListAsync(TestContext.Current.CancellationToken);
        rows.Count.Should().Be(1);
    }

    [Fact]
    public async Task SelfSignUp_OnShiftWithoutSelfSignup_ReturnsSignupNotAllowed()
    {
        var (eventId, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false, allowSelfSignup: false);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        var result = await service.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: false, isSelfSignup: true, TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.SignupNotAllowed);
        result.Assignment.Should().BeNull();
    }

    [Fact]
    public async Task CancelAssignment_OfConfirmed_PromotesWaitlistHead()
    {
        var (eventId, _, shiftId, memberA, memberB) = await SeedShiftAndTwoMembersAsync(capacity: 1, allowWaitlist: true);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        // memberA confirmed, memberB waitlisted.
        var first = await service.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: true, isSelfSignup: true, TestContext.Current.CancellationToken);
        var second = await service.AssignAsync(eventId, shiftId, memberB, memberB, allowWaitlistFallback: true, isSelfSignup: true, TestContext.Current.CancellationToken);
        first.Outcome.Should().Be(VolunteerAssignmentOutcome.Confirmed);
        second.Outcome.Should().Be(VolunteerAssignmentOutcome.Waitlisted);

        // Post-review: CancelAssignmentAsync now takes eventId + caller-context for C1.
        // Staff caller (callerIsStaff: true) bypasses the owner check.
        await service.CancelAssignmentAsync(
            first.Assignment!.Id, "test", eventId,
            callerMemberId: null, callerIsStaff: true,
            TestContext.Current.CancellationToken);

        await using var verify = new ApplicationDbContext(_options);
        var promoted = await verify.EventVolunteerAssignments
            .FirstAsync(a => a.Id == second.Assignment!.Id, TestContext.Current.CancellationToken);
        promoted.Status.Should().Be(VolunteerAssignmentStatus.Confirmed);
        promoted.Position.Should().BeNull();
    }

    [Fact]
    public async Task Migration_AppliedCleanly_CheckConstraintEnforcesCapacityMin()
    {
        var (eventId, roleId, _, _, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false);

        await using var ctx = new ApplicationDbContext(_options);
        var bad = EventVolunteerShift.Create(
            eventId, roleId, "Bad", null, DateTime.UtcNow.AddDays(2), DateTime.UtcNow.AddDays(2).AddHours(1),
            capacity: 1, allowWaitlist: false, allowSelfSignup: false, createdBy: Guid.NewGuid());

        // Force-violate the check constraint by writing directly via raw SQL — the entity
        // factory blocks zero, so we must bypass it to prove the DB-level guard fires.
        Func<Task> act = async () =>
        {
            await ctx.Database.ExecuteSqlInterpolatedAsync($@"
                INSERT INTO event_volunteer_shifts (id, event_id, role_id, title, starts_at, ends_at, capacity,
                                                    allow_waitlist, allow_self_signup, created_at, created_by)
                VALUES ({Guid.NewGuid()}, {eventId}, {roleId}, 'Bad', {bad.StartsAt}, {bad.EndsAt}, 0, FALSE, FALSE, {DateTime.UtcNow}, {Guid.NewGuid()})",
                TestContext.Current.CancellationToken);
        };

        // Raw ExecuteSqlInterpolated propagates PostgresException directly (not wrapped in DbUpdateException).
        await act.Should().ThrowAsync<PostgresException>()
            .Where(e => e.SqlState == "23514"); // check_violation
    }

    [Fact]
    public async Task AssignAsync_OnCancelledShift_ReturnsShiftCancelled()
    {
        // Post-review H-S3-6: new self-signups must be rejected once the shift is cancelled.
        var (eventId, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: true);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        await service.CancelAllAssignmentsForShiftAsync(eventId, shiftId, "venue lost", TestContext.Current.CancellationToken);

        var result = await service.AssignAsync(
            eventId, shiftId, memberA, memberA,
            allowWaitlistFallback: true, isSelfSignup: true,
            TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.ShiftCancelled);
        result.Assignment.Should().BeNull();
    }

    [Fact]
    public async Task AssignAsync_OnShiftFromDifferentEvent_ReturnsShiftNotFound()
    {
        // Post-review H-S3-2: cross-event tampering — the route's eventId must match the shift's parent event.
        var (_, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false);
        var bogusEventId = Guid.NewGuid();

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        var result = await service.AssignAsync(
            bogusEventId, shiftId, memberA, memberA,
            allowWaitlistFallback: false, isSelfSignup: true,
            TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.ShiftNotFound);
    }

    [Fact]
    public async Task AssignAsync_WithNonExistentMember_ReturnsMemberNotFound()
    {
        // Post-review M-S3-2: FK violation on member_id surfaces as MemberNotFound (→ 404), not 500.
        var (eventId, _, shiftId, _, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false);
        var missingMemberId = Guid.NewGuid();

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        var result = await service.AssignAsync(
            eventId, shiftId, missingMemberId, missingMemberId,
            allowWaitlistFallback: false, isSelfSignup: false,
            TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.MemberNotFound);
    }

    [Fact]
    public async Task CancelAssignment_ByNonOwnerNonStaff_ReturnsNotAuthorized()
    {
        // Post-review C1: a member other than the owner (and not staff) cannot cancel.
        var (eventId, _, shiftId, memberA, memberB) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        var assigned = await service.AssignAsync(
            eventId, shiftId, memberA, memberA,
            allowWaitlistFallback: false, isSelfSignup: true,
            TestContext.Current.CancellationToken);
        assigned.Outcome.Should().Be(VolunteerAssignmentOutcome.Confirmed);

        var result = await service.CancelAssignmentAsync(
            assigned.Assignment!.Id, "not yours", eventId,
            callerMemberId: memberB, callerIsStaff: false,
            TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.NotAuthorized);
    }

    [Fact]
    public async Task CancelAssignment_ByOwner_Succeeds()
    {
        // Post-review C1: the owner can cancel their own assignment.
        var (eventId, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        var assigned = await service.AssignAsync(
            eventId, shiftId, memberA, memberA,
            allowWaitlistFallback: false, isSelfSignup: true,
            TestContext.Current.CancellationToken);

        var result = await service.CancelAssignmentAsync(
            assigned.Assignment!.Id, "personal change", eventId,
            callerMemberId: memberA, callerIsStaff: false,
            TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.Cancelled);
    }

    [Fact]
    public async Task CancelAssignment_AcrossEvents_ReturnsAssignmentNotFound()
    {
        // Post-review H-S3-2: cross-event cancel attempts must surface as 404, not 200.
        var (_, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 5, allowWaitlist: false);
        var realEventId = await GetShiftEventIdAsync(shiftId);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));

        var assigned = await service.AssignAsync(
            realEventId, shiftId, memberA, memberA,
            allowWaitlistFallback: false, isSelfSignup: true,
            TestContext.Current.CancellationToken);

        var result = await service.CancelAssignmentAsync(
            assigned.Assignment!.Id, "wrong-event", eventId: Guid.NewGuid(),
            callerMemberId: null, callerIsStaff: true,
            TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(VolunteerAssignmentOutcome.AssignmentNotFound);
    }

    private async Task<Guid> GetShiftEventIdAsync(Guid shiftId)
    {
        await using var ctx = new ApplicationDbContext(_options);
        var shift = await ctx.EventVolunteerShifts.FirstAsync(s => s.Id == shiftId, TestContext.Current.CancellationToken);
        return shift.EventId;
    }

    [Fact]
    public async Task FK_AssignmentMemberId_OnDeleteRestrict_BlocksMemberHardDelete()
    {
        var (eventId, _, shiftId, memberA, _) = await SeedShiftAndTwoMembersAsync(capacity: 1, allowWaitlist: false);

        await using var ctx = new ApplicationDbContext(_options);
        var service = new EventVolunteerAssignmentService(ctx, new EventVolunteerAssignmentRepository(ctx));
        await service.AssignAsync(eventId, shiftId, memberA, memberA, allowWaitlistFallback: false, isSelfSignup: true, TestContext.Current.CancellationToken);

        Func<Task> act = async () =>
        {
            await ctx.Database.ExecuteSqlInterpolatedAsync(
                $"DELETE FROM members WHERE id = {memberA}", TestContext.Current.CancellationToken);
        };

        // FK RESTRICT yields SqlState 23001 (restrict_violation); 23503 covers other FK paths.
        await act.Should().ThrowAsync<PostgresException>()
            .Where(e => e.SqlState == "23001" || e.SqlState == "23503");
    }

    private async Task<(Guid eventId, Guid roleId, Guid shiftId, Guid memberA, Guid memberB)> SeedShiftAndTwoMembersAsync(
        int capacity, bool allowWaitlist, bool allowSelfSignup = true)
    {
        await using var ctx = new ApplicationDbContext(_options);

        var evt = Event.Create("Test", "desc", "Venue", DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(1).AddHours(2));
        await ctx.Events.AddAsync(evt, TestContext.Current.CancellationToken);

        var role = EventVolunteerRole.Create(evt.Id, "Greeter", null, Guid.NewGuid());
        await ctx.EventVolunteerRoles.AddAsync(role, TestContext.Current.CancellationToken);

        var shift = EventVolunteerShift.Create(
            evt.Id, role.Id, "Greeter shift", null,
            DateTime.UtcNow.AddDays(1).AddHours(1), DateTime.UtcNow.AddDays(1).AddHours(3),
            capacity, allowWaitlist, allowSelfSignup, Guid.NewGuid());
        await ctx.EventVolunteerShifts.AddAsync(shift, TestContext.Current.CancellationToken);

        var memberA = Member.Create("Anna", "Alpha", "a@example.com",
            Address.Create("Street 1", "City", "1000", "Country"), MembershipType.Regular);
        var memberB = Member.Create("Bob", "Beta", "b@example.com",
            Address.Create("Street 2", "City", "1000", "Country"), MembershipType.Regular);
        await ctx.Members.AddAsync(memberA, TestContext.Current.CancellationToken);
        await ctx.Members.AddAsync(memberB, TestContext.Current.CancellationToken);

        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        return (evt.Id, role.Id, shift.Id, memberA.Id, memberB.Id);
    }
}
