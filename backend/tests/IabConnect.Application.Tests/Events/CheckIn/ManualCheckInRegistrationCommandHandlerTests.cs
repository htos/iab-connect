using System.Security.Claims;
using FluentAssertions;
using IabConnect.Application.Authorization;
using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-2: the manual-search command must route to the same ID-based service
/// path as the ID-based command. The audit verb (<c>EventCheckInManual</c>) is selected by
/// the handler.
///
/// <para>Round-3 R3-DN-3: the handler now writes the audit row directly. The
/// <see cref="ManualCheckInRegistrationCommand.SearchQueryHash"/> field on the command is
/// included in <c>additionalData</c> when present.</para>
/// </summary>
public sealed class ManualCheckInRegistrationCommandHandlerTests
{
    private static readonly ClaimsPrincipal TestUser = new(new ClaimsIdentity());

    [Fact]
    public async Task Handle_DelegatesToCheckInByIdAsync_AndAuditsAsManual()
    {
        var eventId = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.Success(new EventRegistrationDto
        {
            Id = registrationId,
            EventId = eventId,
            ParticipantName = "Stub",
            Status = "CheckedIn",
            QrCodeToken = "tok",
        });

        var service = new Mock<IEventRegistrationCheckInService>(MockBehavior.Strict);
        service
            .Setup(s => s.CheckInByIdAsync(eventId, registrationId, checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var audit = new Mock<ISecurityAuditLogger>(MockBehavior.Loose);

        var sut = new ManualCheckInRegistrationCommandHandler(service.Object, audit.Object);

        var result = await sut.Handle(
            new ManualCheckInRegistrationCommand(eventId, registrationId, checkedInBy, TestUser, SearchQueryHash: "h4xR9abc12345678"),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        service.Verify(s => s.CheckInByQrCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);

        audit.Verify(a => a.LogAccessGranted(
            TestUser,
            "EventRegistration",
            "EventCheckInManual",
            registrationId.ToString(),
            It.Is<IDictionary<string, object>>(d => (string)d["searchQueryHash"] == "h4xR9abc12345678")),
            Times.Once);
    }

    [Fact]
    public async Task Handle_OmitsSearchQueryHashFromAudit_WhenCommandFieldIsNullOrEmpty()
    {
        var eventId = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.Success(new EventRegistrationDto
        {
            Id = registrationId,
            EventId = eventId,
            ParticipantName = "Stub",
            Status = "CheckedIn",
            QrCodeToken = "tok",
        });

        var service = new Mock<IEventRegistrationCheckInService>(MockBehavior.Strict);
        service
            .Setup(s => s.CheckInByIdAsync(eventId, registrationId, checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var audit = new Mock<ISecurityAuditLogger>(MockBehavior.Loose);

        var sut = new ManualCheckInRegistrationCommandHandler(service.Object, audit.Object);

        await sut.Handle(
            new ManualCheckInRegistrationCommand(eventId, registrationId, checkedInBy, TestUser, SearchQueryHash: null),
            CancellationToken.None);

        audit.Verify(a => a.LogAccessGranted(
            TestUser,
            "EventRegistration",
            "EventCheckInManual",
            registrationId.ToString(),
            It.Is<IDictionary<string, object>>(d => !d.ContainsKey("searchQueryHash"))),
            Times.Once);
    }

    [Fact]
    public async Task Handle_IdempotentOutcome_DoesNotAudit()
    {
        var eventId = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.Idempotent(new EventRegistrationDto
        {
            Id = registrationId,
            EventId = eventId,
            ParticipantName = "Stub",
            Status = "CheckedIn",
            QrCodeToken = "tok",
        });

        var service = new Mock<IEventRegistrationCheckInService>(MockBehavior.Strict);
        service
            .Setup(s => s.CheckInByIdAsync(eventId, registrationId, checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);
        var audit = new Mock<ISecurityAuditLogger>(MockBehavior.Loose);

        var sut = new ManualCheckInRegistrationCommandHandler(service.Object, audit.Object);

        await sut.Handle(
            new ManualCheckInRegistrationCommand(eventId, registrationId, checkedInBy, TestUser, SearchQueryHash: null),
            CancellationToken.None);

        audit.Verify(a => a.LogAccessGranted(
            It.IsAny<ClaimsPrincipal>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, object>>()),
            Times.Never);
    }
}
