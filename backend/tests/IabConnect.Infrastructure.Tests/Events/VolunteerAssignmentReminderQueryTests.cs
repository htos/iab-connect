using FluentAssertions;
using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-024 (E3.S4) AC-9 / R4-P-S4-3: Testcontainers-backed integration coverage for
/// <see cref="EventVolunteerAssignmentRepository.GetRemindersDueAsync"/> — the query the
/// daily reminder pass runs. Verifies the lookahead-window filter (shift <c>StartsAt</c> must
/// fall inside <c>[windowStart, windowEnd]</c>), the <c>Status != Cancelled</c> filter, the
/// already-sent filter (<c>ReminderSentAt == null</c>), and the member-status filter
/// (<c>Status == Active &amp;&amp; MergedIntoMemberId == null</c>) added by R3-M-S4-5.
/// </summary>
public sealed class VolunteerAssignmentReminderQueryTests : IAsyncLifetime
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
    public async Task GetRemindersDueAsync_ConfirmedAssignmentWithShiftInWindow_IsReturned()
    {
        var now = DateTime.UtcNow;
        var assignmentId = await SeedAsync(shiftStartsAt: now.AddHours(12), now);

        var due = await QueryAsync(now, now.AddHours(36));

        due.Should().ContainSingle(r => r.Assignment.Id == assignmentId);
    }

    [Fact]
    public async Task GetRemindersDueAsync_ShiftStartsAfterWindowEnd_IsExcluded()
    {
        var now = DateTime.UtcNow;
        await SeedAsync(shiftStartsAt: now.AddHours(48), now);

        var due = await QueryAsync(now, now.AddHours(36));

        due.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRemindersDueAsync_ShiftStartsBeforeWindowStart_IsExcluded()
    {
        var now = DateTime.UtcNow;
        await SeedAsync(shiftStartsAt: now.AddHours(-2), now);

        var due = await QueryAsync(now, now.AddHours(36));

        due.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRemindersDueAsync_CancelledAssignmentInWindow_IsExcluded()
    {
        var now = DateTime.UtcNow;
        await SeedAsync(shiftStartsAt: now.AddHours(12), now, cancelAssignment: true);

        var due = await QueryAsync(now, now.AddHours(36));

        due.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRemindersDueAsync_AssignmentAlreadyMarkedSent_IsExcluded()
    {
        var now = DateTime.UtcNow;
        await SeedAsync(shiftStartsAt: now.AddHours(12), now, markReminderSent: true);

        var due = await QueryAsync(now, now.AddHours(36));

        due.Should().BeEmpty();
    }

    [Fact]
    public async Task GetRemindersDueAsync_InactiveMember_IsExcluded()
    {
        var now = DateTime.UtcNow;
        // R3-M-S4-5: a Pending (never-activated) member must not be reminded.
        await SeedAsync(shiftStartsAt: now.AddHours(12), now, activateMember: false);

        var due = await QueryAsync(now, now.AddHours(36));

        due.Should().BeEmpty();
    }

    private async Task<IReadOnlyList<VolunteerReminderDueRow>> QueryAsync(DateTime windowStart, DateTime windowEnd)
    {
        await using var ctx = new ApplicationDbContext(_options);
        var repo = new EventVolunteerAssignmentRepository(ctx);
        return await repo.GetRemindersDueAsync(windowStart, windowEnd, TestContext.Current.CancellationToken);
    }

    private async Task<Guid> SeedAsync(
        DateTime shiftStartsAt,
        DateTime now,
        bool cancelAssignment = false,
        bool markReminderSent = false,
        bool activateMember = true)
    {
        await using var ctx = new ApplicationDbContext(_options);

        var evt = Event.Create("Reminder test", "desc", "Venue", now.AddDays(1), now.AddDays(1).AddHours(2));
        await ctx.Events.AddAsync(evt, TestContext.Current.CancellationToken);

        var role = EventVolunteerRole.Create(evt.Id, "Greeter", null, Guid.NewGuid());
        await ctx.EventVolunteerRoles.AddAsync(role, TestContext.Current.CancellationToken);

        var shift = EventVolunteerShift.Create(
            evt.Id, role.Id, "Greeter shift", null,
            shiftStartsAt, shiftStartsAt.AddHours(2),
            capacity: 5, allowWaitlist: false, allowSelfSignup: true, Guid.NewGuid());
        await ctx.EventVolunteerShifts.AddAsync(shift, TestContext.Current.CancellationToken);

        var member = Member.Create("Asha", "Patel", $"asha-{Guid.NewGuid():N}@example.com",
            Address.Create("Street 1", "City", "1000", "Country"), MembershipType.Regular);
        if (activateMember)
            member.Activate();
        await ctx.Members.AddAsync(member, TestContext.Current.CancellationToken);

        var assignment = EventVolunteerAssignment.CreateConfirmed(shift.Id, role.Id, member.Id, Guid.NewGuid());
        if (cancelAssignment)
            assignment.Cancel("not needed");
        await ctx.EventVolunteerAssignments.AddAsync(assignment, TestContext.Current.CancellationToken);

        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        if (markReminderSent)
        {
            var repo = new EventVolunteerAssignmentRepository(ctx);
            await repo.MarkReminderSentAsync(assignment.Id, now, TestContext.Current.CancellationToken);
        }

        return assignment.Id;
    }
}
