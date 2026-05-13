namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023: Privacy-bounded roster surface returned by the event check-in query.
/// Deliberately omits ParticipantEmail, ParticipantPhone, MemberId, UserId, Notes,
/// CancellationReason, and CheckedInBy. Printed paper rosters and shared screens
/// at the venue are PII leak vectors; the check-in flow only needs the lookup keys
/// (QR token, name, status).
/// </summary>
public sealed record EventCheckInRosterDto
{
    public required Guid EventId { get; init; }
    public required string EventTitle { get; init; }
    public required DateTime EventStartDate { get; init; }
    public required string EventLocation { get; init; }
    public required DateTime GeneratedAt { get; init; }

    /// <summary>
    /// REQ-023 (E3.S1 review D-S1-2): number of rows currently rendered in this roster view
    /// — i.e. AFTER applying the Pending/Cancelled drop and the Waitlisted opt-in filter.
    /// When <c>IncludeWaitlisted</c> is false this counts only the confirmed-and-not-cancelled
    /// rows the staff at the door will actually check in; it is NOT the pre-filter total of
    /// every <c>EventRegistration</c> ever attached to the event. The post-filter semantics
    /// keep the "23 / TotalRegistrations" gauge honest for the day-of staff view; if a full
    /// pre-filter total is needed in the future, expose it as a separate field rather than
    /// re-purposing this one (the DTO is published as a public API contract).
    /// </summary>
    public required int TotalRegistrations { get; init; }
    public required int CheckedInCount { get; init; }
    public required IReadOnlyList<EventCheckInRosterItemDto> Items { get; init; }
}

/// <summary>
/// REQ-023: A single roster row exposed to event-day staff.
/// </summary>
public sealed record EventCheckInRosterItemDto
{
    public required Guid RegistrationId { get; init; }
    public required string QrCodeToken { get; init; }
    public required string ParticipantName { get; init; }
    public required int NumberOfGuests { get; init; }
    public required string Status { get; init; }
    public required bool IsWaitlisted { get; init; }
    public required bool IsCheckedIn { get; init; }
    public required DateTime? CheckedInAt { get; init; }
    public required string? SpecialRequirements { get; init; }
}
