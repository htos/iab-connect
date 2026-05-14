using System.Security.Claims;
using MediatR;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): MediatR command for the manual-search check-in entry point.
/// Behaviour is identical to the ID-path of <see cref="CheckInRegistrationCommand"/>; the
/// command name diverges so the audit verb (<c>EventCheckInManual</c>) can be selected by the
/// handler without inspecting the discriminator on the sibling command.
///
/// <para>REQ-023 (E3.S2 Round-3 R3-DN-3): audit is now written from the handler. <see cref="User"/>
/// is the calling principal. <see cref="SearchQueryHash"/> is the optional pre-hashed (SHA-256
/// + base64url prefix) form of the staff member's search input, computed by
/// <see cref="CheckInSearchHasher"/> at the endpoint so the raw search text never crosses the
/// Application boundary.</para>
/// </summary>
public sealed record ManualCheckInRegistrationCommand(
    Guid EventId,
    Guid RegistrationId,
    Guid CheckedInBy,
    ClaimsPrincipal User,
    string? SearchQueryHash) : IRequest<CheckInResultDto>;
