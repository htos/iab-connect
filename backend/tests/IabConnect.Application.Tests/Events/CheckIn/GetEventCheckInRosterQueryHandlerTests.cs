using System.Reflection;
using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Domain.Events;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023: Unit tests for <see cref="GetEventCheckInRosterQueryHandler"/>.
/// Verifies AC-1 (uses repositories), AC-2 (filter/order), AC-3 (privacy DTO),
/// and AC-7 (event scope + archive expiry).
/// </summary>
public sealed class GetEventCheckInRosterQueryHandlerTests
{
    [Fact]
    public async Task Handle_EventNotFound_ReturnsNull()
    {
        var eventRepo = new Mock<IEventRepository>();
        var regRepo = new Mock<IEventRegistrationRepository>();
        eventRepo
            .Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Event?)null);

        var handler = new GetEventCheckInRosterQueryHandler(eventRepo.Object, regRepo.Object);

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(Guid.NewGuid()),
            TestContext.Current.CancellationToken);

        result.Roster.Should().BeNull();
        result.ArchiveExpired.Should().BeFalse();
        regRepo.Verify(r => r.GetByEventIdAsync(It.IsAny<Guid>(), It.IsAny<EventRegistrationFilterOptions?>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_EventSoftDeleted_ReturnsNotFound()
    {
        var evt = CreateEvent();
        SetField(evt, "IsDeleted", true);

        var handler = BuildHandler(evt, Array.Empty<EventRegistration>());

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id),
            TestContext.Current.CancellationToken);

        result.Roster.Should().BeNull();
        result.ArchiveExpired.Should().BeFalse();
    }

    [Fact]
    public async Task Handle_CancelledAndArchiveExpired_ReturnsArchiveExpired()
    {
        // Post-review H-S1-3: the lookup envelope must distinguish "archive expired" from
        // generic not-found so the endpoint can return the spec-required message.
        var evt = CreateEvent();
        SetField(evt, "Status", EventStatus.Cancelled);
        SetField(evt, "CancelledAt", DateTime.UtcNow.AddDays(-91));

        var handler = BuildHandler(evt, Array.Empty<EventRegistration>());

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id),
            TestContext.Current.CancellationToken);

        result.Roster.Should().BeNull();
        result.ArchiveExpired.Should().BeTrue();
    }

    [Fact]
    public async Task Handle_CancelledButWithinArchiveWindow_ReturnsRoster()
    {
        var evt = CreateEvent();
        SetField(evt, "Status", EventStatus.Cancelled);
        SetField(evt, "CancelledAt", DateTime.UtcNow.AddDays(-89));

        var handler = BuildHandler(evt, Array.Empty<EventRegistration>());

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id),
            TestContext.Current.CancellationToken);

        result.Roster.Should().NotBeNull();
        result.ArchiveExpired.Should().BeFalse();
        result.Roster!.Items.Should().BeEmpty();
    }

    [Theory]
    [InlineData(false, 3)] // drop Pending + Cancelled + Waitlisted → keep Confirmed, CheckedIn, NoShow
    [InlineData(true, 4)]  // drop Pending + Cancelled → keep Confirmed, Waitlisted, CheckedIn, NoShow
    public async Task Handle_FiltersByStatus(bool includeWaitlisted, int expectedItemCount)
    {
        var evt = CreateEvent();
        var registrations = new[]
        {
            CreateRegistration(evt.Id, "Alice", RegistrationStatus.Pending),
            CreateRegistration(evt.Id, "Bob", RegistrationStatus.Confirmed),
            CreateRegistration(evt.Id, "Carol", RegistrationStatus.Cancelled),
            CreateRegistration(evt.Id, "Dora", RegistrationStatus.Waitlisted, isWaitlisted: true),
            CreateRegistration(evt.Id, "Eve", RegistrationStatus.CheckedIn),
            CreateRegistration(evt.Id, "Frank", RegistrationStatus.NoShow)
        };

        var handler = BuildHandler(evt, registrations);

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id, includeWaitlisted),
            TestContext.Current.CancellationToken);

        result.Roster.Should().NotBeNull();
        result.Roster!.Items.Should().HaveCount(expectedItemCount);
        result.Roster.Items.Should().NotContain(i => i.Status == RegistrationStatus.Pending.ToString());
        result.Roster.Items.Should().NotContain(i => i.Status == RegistrationStatus.Cancelled.ToString());
    }

    [Fact]
    public async Task Handle_OrdersByFoldedName_ThenRegisteredAt()
    {
        var evt = CreateEvent();
        var t0 = DateTime.UtcNow.AddDays(-3);
        // Where two names fold to the same value (Anna/ANNA, Mueller/Müller),
        // the secondary RegisteredAt ASC tiebreaker drives the order. Test data
        // is wired so the resulting order matches the AC-2 example.
        var registrations = new[]
        {
            CreateRegistration(evt.Id, "Émile", RegistrationStatus.Confirmed, registeredAt: t0.AddMinutes(0)),
            CreateRegistration(evt.Id, "Anna", RegistrationStatus.Confirmed, registeredAt: t0.AddMinutes(1)),
            CreateRegistration(evt.Id, "Mueller", RegistrationStatus.Confirmed, registeredAt: t0.AddMinutes(2)),
            CreateRegistration(evt.Id, "Müller", RegistrationStatus.Confirmed, registeredAt: t0.AddMinutes(3)),
            CreateRegistration(evt.Id, "ANNA", RegistrationStatus.Confirmed, registeredAt: t0.AddMinutes(4)),
            CreateRegistration(evt.Id, "Zacharias", RegistrationStatus.Confirmed, registeredAt: t0.AddMinutes(5))
        };

        var handler = BuildHandler(evt, registrations);

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id),
            TestContext.Current.CancellationToken);

        result.Roster.Should().NotBeNull();
        result.Roster!.Items.Select(i => i.ParticipantName).Should().ContainInOrder(
            "Anna", "ANNA", "Émile", "Mueller", "Müller", "Zacharias");
    }

    [Fact]
    public async Task Handle_PopulatesAggregateCounts()
    {
        var evt = CreateEvent();
        var registrations = new[]
        {
            CreateRegistration(evt.Id, "Alice", RegistrationStatus.Confirmed),
            CreateRegistration(evt.Id, "Bob", RegistrationStatus.CheckedIn, checkedInAt: DateTime.UtcNow),
            CreateRegistration(evt.Id, "Carol", RegistrationStatus.CheckedIn, checkedInAt: DateTime.UtcNow),
            CreateRegistration(evt.Id, "Dora", RegistrationStatus.NoShow)
        };

        var handler = BuildHandler(evt, registrations);

        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id),
            TestContext.Current.CancellationToken);

        result.Roster.Should().NotBeNull();
        result.Roster!.TotalRegistrations.Should().Be(4);
        result.Roster.CheckedInCount.Should().Be(2);
        result.Roster.EventTitle.Should().Be(evt.Title);
        result.Roster.EventStartDate.Should().Be(evt.StartDate);
        result.Roster.EventLocation.Should().Be(evt.Location);
    }

    [Fact]
    public void RosterItemDto_OmitsForbiddenPiiFields()
    {
        var publicMembers = typeof(EventCheckInRosterItemDto)
            .GetProperties(BindingFlags.Public | BindingFlags.Instance)
            .Select(p => p.Name)
            .ToHashSet(StringComparer.Ordinal);

        publicMembers.Should().NotContain("ParticipantEmail");
        publicMembers.Should().NotContain("ParticipantPhone");
        publicMembers.Should().NotContain("MemberId");
        publicMembers.Should().NotContain("UserId");
        publicMembers.Should().NotContain("Notes");
        publicMembers.Should().NotContain("CancellationReason");
        publicMembers.Should().NotContain("CheckedInBy");
    }

    // ----- test helpers -----

    private static GetEventCheckInRosterQueryHandler BuildHandler(
        Event evt,
        IReadOnlyList<EventRegistration> registrations)
    {
        var eventRepo = new Mock<IEventRepository>();
        eventRepo
            .Setup(r => r.GetByIdAsync(evt.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(evt);

        var regRepo = new Mock<IEventRegistrationRepository>();
        regRepo
            .Setup(r => r.GetByEventIdAsync(evt.Id, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(registrations);

        return new GetEventCheckInRosterQueryHandler(eventRepo.Object, regRepo.Object);
    }

    private static Event CreateEvent()
    {
        var evt = Event.Create(
            title: "Jahresversammlung",
            description: "Annual general meeting",
            location: "Vereinshalle Bern",
            startDate: DateTime.UtcNow.AddDays(7),
            endDate: DateTime.UtcNow.AddDays(7).AddHours(3));
        return evt;
    }

    private static EventRegistration CreateRegistration(
        Guid eventId,
        string name,
        RegistrationStatus status,
        bool isWaitlisted = false,
        DateTime? registeredAt = null,
        DateTime? checkedInAt = null)
    {
        var registration = EventRegistration.CreateForGuest(
            eventId,
            participantName: name,
            participantEmail: $"{Guid.NewGuid():N}@example.com",
            numberOfGuests: 1);

        SetField(registration, "Status", status);
        SetField(registration, "IsWaitlisted", isWaitlisted);
        if (registeredAt.HasValue)
            SetField(registration, "RegisteredAt", registeredAt.Value);
        if (checkedInAt.HasValue)
            SetField(registration, "CheckedInAt", checkedInAt.Value);

        return registration;
    }

    private static void SetField<T>(object target, string propertyName, T value)
    {
        var prop = target.GetType().GetProperty(
            propertyName,
            BindingFlags.Public | BindingFlags.Instance);
        prop!.SetValue(target, value);
    }
}
