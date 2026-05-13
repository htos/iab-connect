namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-023 (E3.S2): Result of <see cref="EventRegistration.CheckIn"/>.
/// <para>
/// When a participant is checked in for the first time, the entity transitions
/// to <see cref="RegistrationStatus.CheckedIn"/> and this record carries the
/// new <c>CheckedInAt</c> + <c>CheckedInBy</c> values with
/// <see cref="WasAlreadyCheckedIn"/> = false.
/// </para>
/// <para>
/// When the same registration is checked in again (duplicate scan),
/// <c>CheckIn</c> is idempotent — entity state is NOT mutated and this record
/// returns the ORIGINAL <c>CheckedInAt</c> + <c>CheckedInBy</c> values with
/// <see cref="WasAlreadyCheckedIn"/> = true. This is the contract that lets
/// callers map a duplicate scan to HTTP 200 with a "still checked in" banner
/// instead of HTTP 409 / 500.
/// </para>
/// </summary>
public sealed record CheckInResult(
    bool WasAlreadyCheckedIn,
    DateTime CheckedInAt,
    Guid CheckedInBy);
