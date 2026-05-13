namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): Encapsulates the transactional, FOR-UPDATE-locked check-in
/// flow. Lives in Application as an abstraction; Infrastructure implements it with
/// EF Core (DbContext + <c>BeginTransactionAsync</c> + <c>FromSqlInterpolated</c>).
///
/// <para>Mirrors the <see cref="IabConnect.Application.Members.IMemberMergeService"/>
/// pattern — keeping all SQL/transaction primitives out of the MediatR handlers and out of
/// the API surface.</para>
///
/// <para>Concurrency contract: two staff scanning the same QR token concurrently MUST observe
/// exactly one <see cref="CheckInOutcome.CheckedIn"/> and one
/// <see cref="CheckInOutcome.AlreadyCheckedIn"/> (story AC-8 Infrastructure / action item A6).</para>
/// </summary>
public interface IEventRegistrationCheckInService
{
    /// <summary>
    /// Checks in a registration looked up by its primary key. Verifies that the resolved
    /// registration belongs to the supplied <paramref name="eventId"/>; mismatches return
    /// <see cref="CheckInResultDto.NotFound"/> (URL tampering / wrong event scope).
    /// </summary>
    Task<CheckInResultDto> CheckInByIdAsync(
        Guid eventId,
        Guid registrationId,
        Guid checkedInBy,
        CancellationToken cancellationToken = default);

    /// <summary>
    /// Checks in a registration looked up by its QR-code token. The token uniquely identifies
    /// the registration so no event-scope guard is necessary; if the token is unknown the result
    /// is <see cref="CheckInResultDto.NotFound"/>.
    /// </summary>
    Task<CheckInResultDto> CheckInByQrCodeAsync(
        string qrCodeToken,
        Guid checkedInBy,
        CancellationToken cancellationToken = default);
}
