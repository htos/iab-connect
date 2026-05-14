using FluentAssertions;
using IabConnect.Application.Events;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-021 (E3.S2 H-S2-5 / Epic-3-retro §9 cleanup) + action item A6: concurrent-cancellation
/// race coverage. Two cancellations for the same waitlist-enabled event MUST promote two
/// distinct waitlisted registrations — never double-promote the same row (which previously
/// threw a 500 on the second <c>PromoteFromWaitlist</c>) and never leave a freed slot unfilled.
/// </summary>
public sealed class EventRegistrationCancellationConcurrencyTests : IAsyncLifetime
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

    public async ValueTask DisposeAsync()
    {
        await _postgres.DisposeAsync();
    }

    [Fact]
    public async Task TwoConcurrentCancellations_PromoteTwoDistinctWaitlistedRegistrations()
    {
        var seeded = await SeedWaitlistEnabledEventAsync();

        // Two independent DbContext instances simulate two concurrent scoped requests.
        await using var ctxA = new ApplicationDbContext(_options);
        await using var ctxB = new ApplicationDbContext(_options);

        var taskA = new EventRegistrationCancellationService(ctxA)
            .CancelAsync(seeded.EventId, seeded.ConfirmedAId, "test", true, TestContext.Current.CancellationToken);
        var taskB = new EventRegistrationCancellationService(ctxB)
            .CancelAsync(seeded.EventId, seeded.ConfirmedBId, "test", true, TestContext.Current.CancellationToken);

        var results = await Task.WhenAll(taskA, taskB);

        results.Should().AllSatisfy(r => r.Outcome.Should().Be(CancelRegistrationOutcome.Cancelled));

        // Each cancellation promoted exactly one waitlisted registration, and the two
        // promotions are distinct — the FOR UPDATE event-row lock serialised the two reads of
        // "next on waitlist" so neither raced the other.
        var promotedIds = results.Select(r => r.PromotedFromWaitlist?.Id).ToArray();
        promotedIds.Should().NotContainNulls();
        promotedIds.Should().OnlyHaveUniqueItems();
        promotedIds.Should().BeEquivalentTo(new Guid?[] { seeded.WaitlistedFirstId, seeded.WaitlistedSecondId });

        // DB end state: both waitlisted registrations are now Confirmed, both originals Cancelled.
        await using var verify = new ApplicationDbContext(_options);
        var rows = await verify.EventRegistrations.AsNoTracking()
            .Where(r => r.EventId == seeded.EventId)
            .ToListAsync(TestContext.Current.CancellationToken);

        rows.Single(r => r.Id == seeded.WaitlistedFirstId).Status.Should().Be(RegistrationStatus.Confirmed);
        rows.Single(r => r.Id == seeded.WaitlistedSecondId).Status.Should().Be(RegistrationStatus.Confirmed);
        rows.Single(r => r.Id == seeded.ConfirmedAId).Status.Should().Be(RegistrationStatus.Cancelled);
        rows.Single(r => r.Id == seeded.ConfirmedBId).Status.Should().Be(RegistrationStatus.Cancelled);
    }

    [Fact]
    public async Task CancelAsync_UnknownRegistration_ReturnsNotFound()
    {
        var seeded = await SeedWaitlistEnabledEventAsync();

        await using var ctx = new ApplicationDbContext(_options);
        var result = await new EventRegistrationCancellationService(ctx)
            .CancelAsync(seeded.EventId, Guid.NewGuid(), null, true, TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(CancelRegistrationOutcome.NotFound);
    }

    [Fact]
    public async Task CancelAsync_EventMismatch_ReturnsNotFound()
    {
        var seeded = await SeedWaitlistEnabledEventAsync();

        await using var ctx = new ApplicationDbContext(_options);
        // A real registration id, but a different (non-existent) event id.
        var result = await new EventRegistrationCancellationService(ctx)
            .CancelAsync(Guid.NewGuid(), seeded.ConfirmedAId, null, true, TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(CancelRegistrationOutcome.NotFound);
    }

    private async Task<SeededEvent> SeedWaitlistEnabledEventAsync()
    {
        await using var ctx = new ApplicationDbContext(_options);

        var evt = Event.Create(
            title: "Waitlist Event",
            description: "Test",
            location: "Test Venue",
            startDate: DateTime.UtcNow.AddDays(3),
            endDate: DateTime.UtcNow.AddDays(3).AddHours(2));
        evt.UpdateRegistrationSettings(
            registrationRequired: true,
            maxParticipants: 2,
            registrationDeadline: null,
            waitlistEnabled: true);
        await ctx.Events.AddAsync(evt, TestContext.Current.CancellationToken);

        var confirmedA = EventRegistration.CreateForMember(
            evt.Id, Guid.NewGuid(), Guid.NewGuid(), "Confirmed A", "confirmed-a@example.com");
        var confirmedB = EventRegistration.CreateForMember(
            evt.Id, Guid.NewGuid(), Guid.NewGuid(), "Confirmed B", "confirmed-b@example.com");
        var waitlistedFirst = EventRegistration.CreateWaitlisted(
            evt.Id, Guid.NewGuid(), Guid.NewGuid(), "Waitlisted One", "wl-1@example.com", waitlistPosition: 1);
        var waitlistedSecond = EventRegistration.CreateWaitlisted(
            evt.Id, Guid.NewGuid(), Guid.NewGuid(), "Waitlisted Two", "wl-2@example.com", waitlistPosition: 2);

        await ctx.EventRegistrations.AddRangeAsync(
            new[] { confirmedA, confirmedB, waitlistedFirst, waitlistedSecond },
            TestContext.Current.CancellationToken);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        return new SeededEvent(
            evt.Id, confirmedA.Id, confirmedB.Id, waitlistedFirst.Id, waitlistedSecond.Id);
    }

    private sealed record SeededEvent(
        Guid EventId,
        Guid ConfirmedAId,
        Guid ConfirmedBId,
        Guid WaitlistedFirstId,
        Guid WaitlistedSecondId);
}
