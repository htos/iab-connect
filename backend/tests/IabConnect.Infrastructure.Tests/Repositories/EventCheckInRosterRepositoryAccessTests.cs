using System.Reflection;
using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-023: Integration test that the existing <see cref="IEventRegistrationRepository.GetByEventIdAsync"/>
/// returns all rows for the event and that <see cref="GetEventCheckInRosterQueryHandler"/>
/// narrows the result set per AC-2 (drops Pending + Cancelled).
/// </summary>
public sealed class EventCheckInRosterRepositoryAccessTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private EventRegistrationRepository _registrationRepository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18").Build();
        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _registrationRepository = new EventRegistrationRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    [Fact]
    public async Task RepositoryReturnsAllRegistrations_HandlerNarrowsToFour()
    {
        var ct = TestContext.Current.CancellationToken;

        var evt = Event.Create(
            title: "Sommerfest",
            description: "Annual summer celebration",
            location: "Bern",
            startDate: DateTime.UtcNow.AddDays(7),
            endDate: DateTime.UtcNow.AddDays(7).AddHours(4));
        _context.Events.Add(evt);
        await _context.SaveChangesAsync(ct);

        var registrations = new[]
        {
            SeedRegistration(evt.Id, "Alice", RegistrationStatus.Pending),
            SeedRegistration(evt.Id, "Bob", RegistrationStatus.Confirmed),
            SeedRegistration(evt.Id, "Carol", RegistrationStatus.Cancelled),
            SeedRegistration(evt.Id, "Dora", RegistrationStatus.Waitlisted, isWaitlisted: true),
            SeedRegistration(evt.Id, "Eve", RegistrationStatus.CheckedIn),
            SeedRegistration(evt.Id, "Frank", RegistrationStatus.NoShow)
        };
        foreach (var r in registrations)
            await _registrationRepository.AddAsync(r, ct);

        // Post-review M-S1-4: clear the change tracker so the next read fetches from Postgres
        // instead of the EF first-level cache — proves the round-trip rather than just the
        // staged in-memory state. Mirrors the discipline in MemberRepositoryTests.
        _context.ChangeTracker.Clear();

        var allFromRepo = await _registrationRepository.GetByEventIdAsync(evt.Id, filter: null, ct);
        allFromRepo.Should().HaveCount(6);

        var eventRepo = new Mock<IEventRepository>();
        eventRepo.Setup(r => r.GetByIdAsync(evt.Id, It.IsAny<CancellationToken>())).ReturnsAsync(evt);

        var handler = new GetEventCheckInRosterQueryHandler(eventRepo.Object, _registrationRepository);
        var result = await handler.Handle(
            new GetEventCheckInRosterQuery(evt.Id, IncludeWaitlisted: true),
            ct);

        result.Roster.Should().NotBeNull();
        result.Roster!.Items.Should().HaveCount(4);
        result.Roster.Items.Select(i => i.ParticipantName).Should()
            .BeEquivalentTo(new[] { "Bob", "Dora", "Eve", "Frank" });
    }

    private static EventRegistration SeedRegistration(
        Guid eventId,
        string name,
        RegistrationStatus status,
        bool isWaitlisted = false)
    {
        var registration = EventRegistration.CreateForGuest(
            eventId,
            participantName: name,
            participantEmail: $"{Guid.NewGuid():N}@example.com",
            numberOfGuests: 1);

        SetField(registration, "Status", status);
        SetField(registration, "IsWaitlisted", isWaitlisted);
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
