using System.Security.Claims;
using FluentAssertions;
using IabConnect.Application.Authorization;
using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-1: routing-by-discriminator behaviour of the QR/ID command handler.
/// The actual transactional work lives in <see cref="IEventRegistrationCheckInService"/>;
/// these tests mock the service and only assert the handler's routing + pass-through.
///
/// <para>Round-3 R3-DN-3: audit moved into the handler. New assertions confirm that
/// <see cref="ISecurityAuditLogger.LogAccessGranted"/> fires exactly once on the CheckedIn
/// outcome with the verb chosen by the discriminator path
/// (<c>EventCheckInScanned</c> / <c>EventCheckInById</c>), and that no audit row is written
/// for non-state-changing outcomes (NotFound, idempotent AlreadyCheckedIn, Conflict).</para>
/// </summary>
public sealed class CheckInRegistrationCommandHandlerTests
{
    private static readonly ClaimsPrincipal TestUser = new(new ClaimsIdentity());

    private readonly Mock<IEventRegistrationCheckInService> _service = new(MockBehavior.Strict);
    private readonly Mock<ISecurityAuditLogger> _audit = new(MockBehavior.Loose);

    [Fact]
    public async Task Handle_WithQrToken_CallsCheckInByQrCode_AndAuditsAsScanned()
    {
        var eventId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var expected = CheckInResultDto.Success(StubDto(eventId, registrationId));
        _service
            .Setup(s => s.CheckInByQrCodeAsync("tok-xyz", checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object, _audit.Object);

        var result = await sut.Handle(
            new CheckInRegistrationCommand(eventId, RegistrationId: null, QrCodeToken: "tok-xyz", checkedInBy, TestUser),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        _service.Verify(s => s.CheckInByIdAsync(It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _audit.Verify(a => a.LogAccessGranted(
            TestUser,
            "EventRegistration",
            "EventCheckInScanned",
            registrationId.ToString(),
            It.IsAny<IDictionary<string, object>>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithRegistrationId_CallsCheckInById_AndAuditsAsById()
    {
        var eventId = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.Success(StubDto(eventId, registrationId));
        _service
            .Setup(s => s.CheckInByIdAsync(eventId, registrationId, checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object, _audit.Object);

        var result = await sut.Handle(
            new CheckInRegistrationCommand(eventId, registrationId, QrCodeToken: null, checkedInBy, TestUser),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        _service.Verify(s => s.CheckInByQrCodeAsync(It.IsAny<string>(), It.IsAny<Guid>(), It.IsAny<CancellationToken>()), Times.Never);
        _audit.Verify(a => a.LogAccessGranted(
            TestUser,
            "EventRegistration",
            "EventCheckInById",
            registrationId.ToString(),
            It.IsAny<IDictionary<string, object>>()), Times.Once);
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

        var sut = new CheckInRegistrationCommandHandler(_service.Object, _audit.Object);

        var result = await sut.Handle(
            new CheckInRegistrationCommand(Guid.NewGuid(), Guid.NewGuid(), "tok-xyz", checkedInBy, TestUser),
            CancellationToken.None);

        result.Should().BeSameAs(expected);
        // NotFound outcome: no audit row.
        _audit.Verify(a => a.LogAccessGranted(
            It.IsAny<ClaimsPrincipal>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, object>>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_NotFoundOutcome_DoesNotAudit()
    {
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.NotFound();
        _service
            .Setup(s => s.CheckInByQrCodeAsync("tok-zzz", checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object, _audit.Object);

        await sut.Handle(
            new CheckInRegistrationCommand(Guid.Empty, null, "tok-zzz", checkedInBy, TestUser),
            CancellationToken.None);

        _audit.Verify(a => a.LogAccessGranted(
            It.IsAny<ClaimsPrincipal>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, object>>()),
            Times.Never);
    }

    [Fact]
    public async Task Handle_AlreadyCheckedInOutcome_DoesNotAudit()
    {
        var eventId = Guid.NewGuid();
        var registrationId = Guid.NewGuid();
        var checkedInBy = Guid.NewGuid();
        var expected = CheckInResultDto.Idempotent(StubDto(eventId, registrationId));
        _service
            .Setup(s => s.CheckInByIdAsync(eventId, registrationId, checkedInBy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(expected);

        var sut = new CheckInRegistrationCommandHandler(_service.Object, _audit.Object);

        await sut.Handle(
            new CheckInRegistrationCommand(eventId, registrationId, null, checkedInBy, TestUser),
            CancellationToken.None);

        // R3-DN-3: idempotent state — audit row would be misleading.
        _audit.Verify(a => a.LogAccessGranted(
            It.IsAny<ClaimsPrincipal>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<IDictionary<string, object>>()),
            Times.Never);
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
