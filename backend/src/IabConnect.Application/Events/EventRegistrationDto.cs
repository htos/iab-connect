using IabConnect.Domain.Events;

namespace IabConnect.Application.Events;

/// <summary>
/// REQ-020 / REQ-023: API-facing projection of <see cref="EventRegistration"/>.
/// Lives in Application so command/query handlers can return it without inverting
/// the Api → Application reference. The API namespace re-uses this type unchanged.
/// </summary>
public record EventRegistrationDto
{
    public Guid Id { get; init; }
    public Guid EventId { get; init; }
    public Guid? UserId { get; init; }
    public Guid? MemberId { get; init; }
    public string ParticipantName { get; init; } = string.Empty;
    public string ParticipantEmail { get; init; } = string.Empty;
    public string? ParticipantPhone { get; init; }
    public int NumberOfGuests { get; init; }
    public string Status { get; init; } = string.Empty;
    public bool IsWaitlisted { get; init; }
    public int? WaitlistPosition { get; init; }
    public DateTime RegisteredAt { get; init; }
    public DateTime? ConfirmedAt { get; init; }
    public DateTime? CancelledAt { get; init; }
    public string? CancellationReason { get; init; }
    public DateTime? CheckedInAt { get; init; }
    public bool IsNoShow { get; init; }
    public string? Notes { get; init; }
    public string? SpecialRequirements { get; init; }
    public string QrCodeToken { get; init; } = string.Empty;
    public bool IsActive { get; init; }
    public bool IsCheckedIn { get; init; }

    /// <summary>
    /// Maps an <see cref="EventRegistration"/> aggregate to its DTO projection.
    /// </summary>
    public static EventRegistrationDto FromEntity(EventRegistration r) => new()
    {
        Id = r.Id,
        EventId = r.EventId,
        UserId = r.UserId,
        MemberId = r.MemberId,
        ParticipantName = r.ParticipantName,
        ParticipantEmail = r.ParticipantEmail,
        ParticipantPhone = r.ParticipantPhone,
        NumberOfGuests = r.NumberOfGuests,
        Status = r.Status.ToString(),
        IsWaitlisted = r.IsWaitlisted,
        WaitlistPosition = r.WaitlistPosition,
        RegisteredAt = r.RegisteredAt,
        ConfirmedAt = r.ConfirmedAt,
        CancelledAt = r.CancelledAt,
        CancellationReason = r.CancellationReason,
        CheckedInAt = r.CheckedInAt,
        IsNoShow = r.IsNoShow,
        Notes = r.Notes,
        SpecialRequirements = r.SpecialRequirements,
        QrCodeToken = r.QrCodeToken,
        IsActive = r.IsActive,
        IsCheckedIn = r.IsCheckedIn,
    };
}
