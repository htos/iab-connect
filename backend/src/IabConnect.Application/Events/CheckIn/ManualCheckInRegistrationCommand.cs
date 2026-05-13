using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): MediatR command for the manual-search check-in entry point.
/// Behaviour is identical to the ID-path of <see cref="CheckInRegistrationCommand"/>; the
/// command name + endpoint route diverge so the audit-verb discriminator
/// (<c>EventCheckInManual</c>) can be picked up at the endpoint layer.
/// </summary>
public sealed record ManualCheckInRegistrationCommand(
    Guid EventId,
    Guid RegistrationId,
    Guid CheckedInBy) : IRequest<CheckInResultDto>;
