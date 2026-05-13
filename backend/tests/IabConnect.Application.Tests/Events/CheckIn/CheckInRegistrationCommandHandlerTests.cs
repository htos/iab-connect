using FluentAssertions;
using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-1: routing-by-discriminator behaviour of the QR/ID command handler.
/// The actual transactional work lives in <see cref="IEventRegistrationCheckInService"/>;
/// these tests mock the service and only assert the handler's routing + pass-through.
/// </summary>
public sealed class CheckInRegistrationCommandHandlerTests
{
    private readonly Mock<IEventRegistrationCheckInService> _service = new(MockBehavior.Strict);

    [Fact]
    public async Task Handle_WithQrToken_CallsCheckInByQrCode()
    {
        var eventId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.NotFound();
        _service
            .Setup(s => s.CheckInByQrCodeAsync("tok-xyz", checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object);

        var result = await sut.Handle(
            new CheckInRegistrationCommand(eventId, RegistrationId: null, QrCodeToken: "tok-xyz", checkedInBy),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        _service.Verify(s => s.CheckInByIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_WithRegistrationId_CallsCheckInById()
    {
        var eventId = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.Success(StubDto(eventId, registrationId));
        _service
            .Setup(s => s.CheckInByIdAsync(eventId, registrationId, checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object);

        var result = await sut.Handle(
            new CheckInRegistrationCommand(eventId, registrationId, QrCodeToken: null, checkedInBy),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        _service.Verify(s => s.CheckInByQrCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_PrefersQrTokenWhenBothProvided_BecauseValidatorShouldHaveBlockedIt()
    {
        // Defensive: the validator rejects "both set"; if we ever reach the handler with both,
        // the QR path wins (string-discriminator first) — keeps behaviour deterministic.
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.NotFound();
        _service
            .Setup(s => s.CheckInByQrCodeAsync("tok-xyz", checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object);

        var result = await sut.Handle(
            new CheckInRegistrationCommand(Guid.NewGuid(), Guid.NewGuid(), "tok-xyz", checkedInBy),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
    }

    private static EventRegistrationDto StubDto(Guid eventId, Guid registrationId) => new()
    {
        Id = registrationId,
        EventId = eventId,
        ParticipantName = "Stub",
        Status = "CheckedIn",
        QrCodeToken = "tok",
    };
}
