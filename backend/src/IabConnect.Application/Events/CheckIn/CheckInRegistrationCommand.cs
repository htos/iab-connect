using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): MediatR command for the QR-scan and registration-ID check-in entry points.
/// Exactly one of <see cref="RegistrationId"/> / <see cref="QrCodeToken"/> MUST be non-null —
/// enforced by <see cref="CheckInRegistrationCommandValidator"/>.
///
/// <para>For <see cref="QrCodeToken"/>-driven calls, <see cref="EventId"/> is informational only
/// (token uniquely identifies the registration). For <see cref="RegistrationId"/>-driven calls,
/// the handler checks the resolved registration's event matches <see cref="EventId"/> and
/// returns <see cref="CheckInOutcome.NotFound"/> on mismatch.</para>
/// </summary>
public sealed record CheckInRegistrationCommand(
    Guid EventId,
    Guid? RegistrationId,
    string? QrCodeToken,
    Guid CheckedInBy) : IRequest<CheckInResultDto>;
