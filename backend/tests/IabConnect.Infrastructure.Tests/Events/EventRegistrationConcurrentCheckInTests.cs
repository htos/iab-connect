using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Events;

/// <summary>
/// REQ-023 (E3.S2) AC-8 + action item A6: concurrent-mutation race coverage.
/// Two staff scanning the same QR token concurrently MUST observe exactly one
/// state-changing check-in and one idempotent return; the DB row must carry a single
/// <c>CheckedInAt</c> + <c>CheckedInBy</c>.
/// </summary>
public sealed class EventRegistrationConcurrentCheckInTests : IAsyncLifetime
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
    public async Task TwoStaffScanningSameQrToken_ResultInExactlyOneStateChange()
    {
        // Arrange: seed event + a confirmed registration with a known QR token.
        var (eventId, registrationId, qrToken) = await SeedConfirmedRegistrationAsync();

        var staffA = Guid.NewGuid();
        var staffB = Guid.NewGuid();

        // Two independent DbContext instances simulate two concurrent staff scoped requests.
        await using var ctxA = new ApplicationDbContext(_options);
        await using var ctxB = new ApplicationDbContext(_options);

        var serviceA = new EventRegistrationCheckInService(ctxA);
        var serviceB = new EventRegistrationCheckInService(ctxB);

        // Act: race two FOR UPDATE-locked check-ins on the same token.
        var taskA = serviceA.CheckInByQrCodeAsync(qrToken, staffA, TestContext.Current.CancellationToken);
        var taskB = serviceB.CheckInByQrCodeAsync(qrToken, staffB, TestContext.Current.CancellationToken);

        var results = await Task.WhenAll(taskA, taskB);

        // Assert: exactly one is CheckedIn, exactly one is AlreadyCheckedIn.
        var checkedIn = results.Count(r => r.Outcome == CheckInOutcome.CheckedIn);
        var idempotent = results.Count(r => r.Outcome == CheckInOutcome.AlreadyCheckedIn);

        checkedIn.Should().Be(1, "exactly one task should observe the real state change");
        idempotent.Should().Be(1, "the other task must see the idempotent already-checked-in path");

        // The single DB row has one CheckedInAt + one CheckedInBy — no doubled state.
        await using var verifyCtx = new ApplicationDbContext(_options);
        var row = await verifyCtx.EventRegistrations
            .AsNoTracking()
            .SingleAsync(r => r.Id == registrationId, TestContext.Current.CancellationToken);

        row.CheckedInAt.Should().NotBeNull();
        row.CheckedInBy.Should().NotBeNull();
        row.Status.Should().Be(RegistrationStatus.CheckedIn);

        // The winning staff id is whichever task observed CheckedIn.
        var winningResult = results.Single(r => r.Outcome == CheckInOutcome.CheckedIn);
        winningResult.Registration!.IsCheckedIn.Should().BeTrue();
        // Post-review M-S2-2: previously this asserted `X.Should().Be(X)` (a tautology produced
        // by a conditional whose true-branch returned the same value being asserted on). The
        // real claim is that the DB row's CheckedInBy is one of the two task staff ids — that
        // assertion is below.

        // The losing staff id MUST be ignored — the DB row stays with the winning staff id.
        var winningStaffId = row.CheckedInBy!.Value;
        new[] { staffA, staffB }.Should().Contain(winningStaffId);
    }

    [Fact]
    public async Task CheckInByQrCode_UnknownToken_ReturnsNotFound()
    {
        await using var ctx = new ApplicationDbContext(_options);
        var sut = new EventRegistrationCheckInService(ctx);

        var result = await sut.CheckInByQrCodeAsync("does-not-exist", Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(CheckInOutcome.NotFound);
        result.Registration.Should().BeNull();
    }

    [Fact]
    public async Task CheckInById_EventMismatch_ReturnsNotFound()
    {
        var (_, registrationId, _) = await SeedConfirmedRegistrationAsync();
        var otherEventId = Guid.NewGuid();

        await using var ctx = new ApplicationDbContext(_options);
        var sut = new EventRegistrationCheckInService(ctx);

        var result = await sut.CheckInByIdAsync(otherEventId, registrationId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(CheckInOutcome.NotFound);
    }

    [Fact]
    public async Task CheckInById_CancelledRegistration_ReturnsCancelledConflict()
    {
        var (eventId, registrationId, _) = await SeedConfirmedRegistrationAsync(cancelled: true);

        await using var ctx = new ApplicationDbContext(_options);
        var sut = new EventRegistrationCheckInService(ctx);

        var result = await sut.CheckInByIdAsync(eventId, registrationId, Guid.NewGuid(), TestContext.Current.CancellationToken);

        result.Outcome.Should().Be(CheckInOutcome.Conflict);
        result.Conflict.Should().Be(ConflictReason.Cancelled);
    }

    private async Task<(Guid eventId, Guid registrationId, string qrToken)> SeedConfirmedRegistrationAsync(bool cancelled = false)
    {
        await using var ctx = new ApplicationDbContext(_options);

        var evt = Event.Create(
            title: "Test Event",
            description: "Test",
            location: "Test Venue",
            startDate: DateTime.UtcNow.AddDays(1),
            endDate: DateTime.UtcNow.AddDays(1).AddHours(2));
        await ctx.Events.AddAsync(evt, TestContext.Current.CancellationToken);

        var registration = EventRegistration.CreateForMember(
            evt.Id,
            userId: Guid.NewGuid(),
            memberId: Guid.NewGuid(),
            participantName: "Test Person",
            participantEmail: "test@example.com",
            numberOfGuests: 1);

        if (cancelled)
            registration.Cancel("integration-test cancel");

        await ctx.EventRegistrations.AddAsync(registration, TestContext.Current.CancellationToken);
        await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);

        return (evt.Id, registration.Id, registration.QrCodeToken);
    }
}
