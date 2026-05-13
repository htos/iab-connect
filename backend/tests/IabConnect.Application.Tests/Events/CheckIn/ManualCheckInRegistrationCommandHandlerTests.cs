using FluentAssertions;
using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-2: the manual-search command must route to the same ID-based service
/// path as the ID-based command. The audit verb diverges at the endpoint, not at the handler.
/// </summary>
public sealed class ManualCheckInRegistrationCommandHandlerTests
{
    [Fact]
    public async Task Handle_DelegatesToCheckInByIdAsync()
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

        var sut = new ManualCheckInRegistrationCommandHandler(service.Object);

        var result = await sut.Handle(
            new ManualCheckInRegistrationCommand(eventId, registrationId, checkedInBy),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        service.Verify(s => s.CheckInByQrCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
