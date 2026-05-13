namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): Typed surface for all three check-in entry points
/// (QR-token, registration-ID, manual-search). The API maps this to HTTP without
/// pattern-matching on exception messages.
///
/// <para>Discriminator rules (matches story AC-3 + AC-5):
/// <list type="bullet">
///   <item><c>CheckedIn</c> — registration was state-changed by this call. Registration is non-null.
///         Audit MUST log a <c>LogAccessGranted</c> row.</item>
///   <item><c>AlreadyCheckedIn</c> — entity returned <c>WasAlreadyCheckedIn = true</c>; no state
///         change occurred. Registration is non-null and reflects the prior CheckedInAt/By.
///         Audit MUST NOT write a granted row (that would mislead the audit trail).</item>
///   <item><c>NotFound</c> — registration not located by id/token, OR the resolved registration's
///         <c>EventId</c> did not match the request's event scope. Registration is null.</item>
///   <item><c>Conflict</c> — registration is in <c>Cancelled</c> or <c>Waitlisted</c> state.
///         <c>Conflict</c> field carries the typed reason; Registration is non-null.</item>
/// </list></para>
/// </summary>
public sealed record CheckInResultDto(
    CheckInOutcome Outcome,
    EventRegistrationDto? Registration,
    bool WasAlreadyCheckedIn,
    ConflictReason? Conflict)
{
    public static CheckInResultDto NotFound() =>
        new(CheckInOutcome.NotFound, Registration: null, WasAlreadyCheckedIn: false, Conflict: null);

    public static CheckInResultDto Cancelled(EventRegistrationDto registration) =>
        new(CheckInOutcome.Conflict, registration, WasAlreadyCheckedIn: false, ConflictReason.Cancelled);

    public static CheckInResultDto Waitlisted(EventRegistrationDto registration) =>
        new(CheckInOutcome.Conflict, registration, WasAlreadyCheckedIn: false, ConflictReason.Waitlisted);

    public static CheckInResultDto Success(EventRegistrationDto registration) =>
        new(CheckInOutcome.CheckedIn, registration, WasAlreadyCheckedIn: false, Conflict: null);

    public static CheckInResultDto Idempotent(EventRegistrationDto registration) =>
        new(CheckInOutcome.AlreadyCheckedIn, registration, WasAlreadyCheckedIn: true, Conflict: null);
}

public enum CheckInOutcome
{
    CheckedIn,
    AlreadyCheckedIn,
    NotFound,
    Conflict,
}

public enum ConflictReason
{
    Cancelled,
    Waitlisted,
}
