namespace IabConnect.Application.Events.Calendar;

/// <summary>
/// REQ-025 (E3.S5 Round-3 R3-H-S5-5 / Epic-3-retro §9 cleanup): transactional,
/// <c>FOR UPDATE</c> row-locked calendar-token rotation and revocation.
///
/// <para>The rotate path regenerates the member's opaque token and persists only its hash;
/// the cleartext is returned to the caller exactly once. Without a row lock, a rapid
/// double-rotate (the user double-clicks the button) races: two responses come back, but
/// only the last-persisted hash matches one of the returned tokens — the other client's
/// subscription URL is dead on arrival. A <c>FOR UPDATE</c> lock on the Member row
/// serialises concurrent rotate/revoke calls for the same member so the persisted state
/// always matches the response that observed it.</para>
///
/// <para>Mirrors <c>IEventRegistrationCheckInService</c> / <c>MemberMergeService</c>: the
/// transaction primitive lives in Infrastructure, the Application layer stays EF-free.</para>
/// </summary>
public interface ICalendarTokenService
{
    /// <summary>
    /// Regenerates the calling member's calendar-subscription token under a row lock.
    /// Returns <see cref="CalendarTokenRotationResult.NotFound"/> when no active, non-merged
    /// member is linked to <paramref name="keycloakUserId"/>.
    /// </summary>
    Task<CalendarTokenRotationResult> RotateAsync(Guid keycloakUserId, CancellationToken cancellationToken = default);

    /// <summary>
    /// Revokes the calling member's calendar-subscription token under a row lock. Returns
    /// false when no active, non-merged member is linked to <paramref name="keycloakUserId"/>.
    /// </summary>
    Task<bool> RevokeAsync(Guid keycloakUserId, CancellationToken cancellationToken = default);
}

/// <summary>
/// Outcome of <see cref="ICalendarTokenService.RotateAsync"/>. <see cref="Token"/> is the new
/// cleartext token — exposed exactly once — and is non-null only when <see cref="MemberFound"/>
/// is true.
/// </summary>
public sealed record CalendarTokenRotationResult(bool MemberFound, Guid MemberId, string? Token)
{
    public static CalendarTokenRotationResult NotFound() => new(false, Guid.Empty, null);

    public static CalendarTokenRotationResult Rotated(Guid memberId, string token) =>
        new(true, memberId, token);
}
