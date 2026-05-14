using System.Security.Claims;
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
///
/// <para>REQ-023 (E3.S2 Round-3 R3-DN-3): the <see cref="User"/> field carries the calling
/// principal so the handler can write the <c>LogAccessGranted</c> audit row directly. The
/// previous design audit-logged at the endpoint; the round-3 decision moved audit into the
/// handler so any future internal caller (a background command dispatch, an integration test
/// that bypasses HTTP) still produces an audit trail. <see cref="ClaimsPrincipal"/> is in
/// <c>System.Security.Claims</c>, already a dependency of <see cref="IabConnect.Application.Authorization.ISecurityAuditLogger"/>,
/// so this does not introduce ASP.NET coupling into Application.</para>
/// </summary>
public sealed record CheckInRegistrationCommand(
    Guid EventId,
    Guid? RegistrationId,
    string? QrCodeToken,
    Guid CheckedInBy,
    ClaimsPrincipal User) : IRequest<CheckInResultDto>;
