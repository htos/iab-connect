using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Reporting;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Events;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Reporting;

public class ExportEventRegistrationsQueryHandlerTests
{
    private readonly Mock<IEventRepository> _eventRepo = new();
    private readonly Mock<IEventRegistrationRepository> _registrationRepo = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly ExportEventRegistrationsQueryHandler _handler;

    public ExportEventRegistrationsQueryHandlerTests()
    {
        _handler = new ExportEventRegistrationsQueryHandler(
            _eventRepo.Object,
            _registrationRepo.Object,
            _auditService.Object);
    }

    [Fact]
    public async Task Handle_WithEventNotFound_ShouldThrowKeyNotFoundException()
    {
        // Arrange
        var eventId = Guid.NewGuid();
        _eventRepo.Setup(r => r.GetByIdAsync(eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Event?)null);

        // Act
        var act = () => _handler.Handle(new ExportEventRegistrationsQuery(eventId), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<KeyNotFoundException>()
            .WithMessage($"*{eventId}*");
    }

    [Fact]
    public async Task Handle_ShouldReturnCsvWithHeaderAndRegistrations()
    {
        // Arrange
        var eventId = Guid.NewGuid();
        var evt = Event.Create("Test Event", "Desc", "Location",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        _eventRepo.Setup(r => r.GetByIdAsync(eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(evt);

        var registrations = new List<EventRegistration>
        {
            EventRegistration.CreateForMember(eventId, Guid.NewGuid(), Guid.NewGuid(), "Alice Muster", "alice@test.com", 1, "+41 44 111"),
            EventRegistration.CreateForGuest(eventId, "Bob Guest", "bob@test.com", 2, "+41 44 222"),
        };
        _registrationRepo
            .Setup(r => r.GetByEventIdAsync(eventId, It.IsAny<EventRegistrationFilterOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(registrations);

        // Act
        var result = await _handler.Handle(new ExportEventRegistrationsQuery(eventId), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.ContentType.Should().Be("text/csv");
        result.FileName.Should().Contain("registrations_");
        result.FileName.Should().EndWith(".csv");

        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines[0].Should().Contain("ParticipantName;Email;Phone;Status");
        lines.Should().HaveCount(3); // Header + 2 registrations
    }

    [Fact]
    public async Task Handle_ShouldOrderByParticipantName()
    {
        // Arrange
        var eventId = Guid.NewGuid();
        var evt = Event.Create("Test", "Desc", "Loc",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        _eventRepo.Setup(r => r.GetByIdAsync(eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(evt);

        var registrations = new List<EventRegistration>
        {
            EventRegistration.CreateForMember(eventId, Guid.NewGuid(), Guid.NewGuid(), "Zara Zürich", "zara@test.com"),
            EventRegistration.CreateForMember(eventId, Guid.NewGuid(), Guid.NewGuid(), "Alice Aarau", "alice@test.com"),
        };
        _registrationRepo
            .Setup(r => r.GetByEventIdAsync(eventId, It.IsAny<EventRegistrationFilterOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(registrations);

        // Act
        var result = await _handler.Handle(new ExportEventRegistrationsQuery(eventId), CancellationToken.None);

        // Assert
        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines[1].Should().StartWith("Alice Aarau");
        lines[2].Should().StartWith("Zara");
    }

    [Fact]
    public async Task Handle_WithNoRegistrations_ShouldReturnHeaderOnly()
    {
        // Arrange
        var eventId = Guid.NewGuid();
        var evt = Event.Create("Empty Event", "Desc", "Loc",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        _eventRepo.Setup(r => r.GetByIdAsync(eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(evt);
        _registrationRepo
            .Setup(r => r.GetByEventIdAsync(eventId, It.IsAny<EventRegistrationFilterOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<EventRegistration>());

        // Act
        var result = await _handler.Handle(new ExportEventRegistrationsQuery(eventId), CancellationToken.None);

        // Assert
        var csv = System.Text.Encoding.UTF8.GetString(result.Content);
        var lines = csv.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Should().HaveCount(1); // Header only
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        var eventId = Guid.NewGuid();
        var evt = Event.Create("Audit Test Event", "Desc", "Loc",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        _eventRepo.Setup(r => r.GetByIdAsync(eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(evt);
        _registrationRepo
            .Setup(r => r.GetByEventIdAsync(eventId, It.IsAny<EventRegistrationFilterOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<EventRegistration>());

        // Act
        await _handler.Handle(new ExportEventRegistrationsQuery(eventId), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.DataExported,
            It.Is<string>(s => s.Contains("Event registrations exported")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            It.Is<string?>(s => s == "EventRegistration"),
            It.Is<string?>(s => s == eventId.ToString()),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldSanitizeEventTitleInFilename()
    {
        // Arrange
        var eventId = Guid.NewGuid();
        var evt = Event.Create("Event with spaces and;special", "Desc", "Loc",
            DateTime.UtcNow.AddDays(7), DateTime.UtcNow.AddDays(7).AddHours(2));
        _eventRepo.Setup(r => r.GetByIdAsync(eventId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(evt);
        _registrationRepo
            .Setup(r => r.GetByEventIdAsync(eventId, It.IsAny<EventRegistrationFilterOptions?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<EventRegistration>());

        // Act
        var result = await _handler.Handle(new ExportEventRegistrationsQuery(eventId), CancellationToken.None);

        // Assert
        result.FileName.Should().NotContain(" ");
        result.FileName.Should().NotContain(";");
    }
}
