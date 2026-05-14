using IabConnect.Domain.Common;

namespace IabConnect.Domain.Events.Volunteers;

/// <summary>
/// REQ-024 (E3.S3): A single staffing slot within an event for one volunteer role.
/// Has a start/end window, a confirmed-volunteer <see cref="Capacity"/>, and per-shift
/// policy flags for waitlist + self-signup. The contested resource in the AC-6 concurrency
/// protocol is the shift row — assignment handlers <c>SELECT ... FOR UPDATE</c> this row
/// before reading capacity counts.
/// </summary>
public sealed class EventVolunteerShift : Entity
{
    public const int TitleMaxLength = 200;
    public const int DescriptionMaxLength = 1000;
    public const int NotesMaxLength = 1000;
    public const int CancellationReasonMaxLength = 500;

    public Guid EventId { get; private set; }
    public Guid RoleId { get; private set; }
    public string Title { get; private set; } = string.Empty;
    public string? Description { get; private set; }
    public DateTime StartsAt { get; private set; }
    public DateTime EndsAt { get; private set; }
    public int Capacity { get; private set; }
    public bool AllowWaitlist { get; private set; }
    public bool AllowSelfSignup { get; private set; }
    public string? Notes { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public Guid CreatedBy { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    /// <summary>
    /// REQ-024 (E3.S3, post-review H-S3-6): Lifecycle status. New shifts start <see cref="VolunteerShiftStatus.Active"/>;
    /// flipping to <see cref="VolunteerShiftStatus.Cancelled"/> rejects further assignments.
    /// </summary>
    public VolunteerShiftStatus Status { get; private set; } = VolunteerShiftStatus.Active;

    /// <summary>REQ-024 (E3.S3, post-review H-S3-6): UTC timestamp the shift was cancelled.</summary>
    public DateTime? CancelledAt { get; private set; }

    /// <summary>REQ-024 (E3.S3, post-review H-S3-6): Operator-supplied cancellation reason (optional).</summary>
    public string? CancellationReason { get; private set; }

    private EventVolunteerShift() { }

    public static EventVolunteerShift Create(
        Guid eventId,
        Guid roleId,
        string title,
        string? description,
        DateTime startsAt,
        DateTime endsAt,
        int capacity,
        bool allowWaitlist,
        bool allowSelfSignup,
        Guid createdBy,
        string? notes = null)
    {
        if (eventId == Guid.Empty) throw new ArgumentException("EventId is required", nameof(eventId));
        if (roleId == Guid.Empty) throw new ArgumentException("RoleId is required", nameof(roleId));
        if (createdBy == Guid.Empty) throw new ArgumentException("CreatedBy is required", nameof(createdBy));
        var trimmedTitle = (title ?? throw new ArgumentNullException(nameof(title))).Trim();
        if (string.IsNullOrEmpty(trimmedTitle))
            throw new ArgumentException("Title is required", nameof(title));
        if (trimmedTitle.Length > TitleMaxLength)
            throw new ArgumentException($"Title cannot exceed {TitleMaxLength} characters", nameof(title));
        var trimmedDescription = description?.Trim();
        if (trimmedDescription is { Length: > DescriptionMaxLength })
            throw new ArgumentException($"Description cannot exceed {DescriptionMaxLength} characters", nameof(description));
        var trimmedNotes = notes?.Trim();
        if (trimmedNotes is { Length: > NotesMaxLength })
            throw new ArgumentException($"Notes cannot exceed {NotesMaxLength} characters", nameof(notes));
        // R4-P-S3-1: normalize to UTC at the domain boundary so EventNotificationService's
        // local-zone formatting can trust the Kind, matching the Event aggregate's guard.
        startsAt = DateTimeUtcGuard.EnsureUtc(startsAt);
        endsAt = DateTimeUtcGuard.EnsureUtc(endsAt);
        if (endsAt <= startsAt)
            throw new ArgumentException("EndsAt must be greater than StartsAt", nameof(endsAt));
        if (capacity < 1)
            throw new ArgumentException("Capacity must be at least 1", nameof(capacity));

        return new EventVolunteerShift
        {
            Id = Guid.NewGuid(),
            EventId = eventId,
            RoleId = roleId,
            Title = trimmedTitle,
            Description = string.IsNullOrEmpty(trimmedDescription) ? null : trimmedDescription,
            StartsAt = startsAt,
            EndsAt = endsAt,
            Capacity = capacity,
            AllowWaitlist = allowWaitlist,
            AllowSelfSignup = allowSelfSignup,
            Notes = string.IsNullOrEmpty(trimmedNotes) ? null : trimmedNotes,
            CreatedAt = DateTime.UtcNow,
            CreatedBy = createdBy,
        };
    }

    public void UpdateDetails(
        string title,
        string? description,
        DateTime startsAt,
        DateTime endsAt,
        bool allowWaitlist,
        bool allowSelfSignup,
        string? notes)
    {
        var trimmedTitle = (title ?? throw new ArgumentNullException(nameof(title))).Trim();
        if (string.IsNullOrEmpty(trimmedTitle))
            throw new ArgumentException("Title is required", nameof(title));
        if (trimmedTitle.Length > TitleMaxLength)
            throw new ArgumentException($"Title cannot exceed {TitleMaxLength} characters", nameof(title));
        // R4-P-S3-1: normalize to UTC at the domain boundary (see Create).
        startsAt = DateTimeUtcGuard.EnsureUtc(startsAt);
        endsAt = DateTimeUtcGuard.EnsureUtc(endsAt);
        if (endsAt <= startsAt)
            throw new ArgumentException("EndsAt must be greater than StartsAt", nameof(endsAt));
        var trimmedDescription = description?.Trim();
        if (trimmedDescription is { Length: > DescriptionMaxLength })
            throw new ArgumentException($"Description cannot exceed {DescriptionMaxLength} characters", nameof(description));
        var trimmedNotes = notes?.Trim();
        if (trimmedNotes is { Length: > NotesMaxLength })
            throw new ArgumentException($"Notes cannot exceed {NotesMaxLength} characters", nameof(notes));

        Title = trimmedTitle;
        Description = string.IsNullOrEmpty(trimmedDescription) ? null : trimmedDescription;
        StartsAt = startsAt;
        EndsAt = endsAt;
        AllowWaitlist = allowWaitlist;
        AllowSelfSignup = allowSelfSignup;
        Notes = string.IsNullOrEmpty(trimmedNotes) ? null : trimmedNotes;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// REQ-024 (E3.S3): Updates the shift's confirmed-volunteer capacity. Despite the historical
    /// name, the operation is bidirectional — managers may DECREASE capacity down to (but not
    /// below) the current confirmed count, which lets them close newly-empty slots after
    /// cancellations without needing to delete and recreate the shift. The lower-bound is
    /// enforced as a domain invariant; the storage-layer CHECK constraint
    /// <c>ck_event_volunteer_shifts_capacity_min</c> enforces <c>capacity &gt;= 1</c>.
    /// Renamed from <c>IncreaseCapacity</c> per the Epic-3 review H-S3-4 finding.
    /// </summary>
    public void UpdateCapacity(int newCapacity, int currentConfirmedCount)
    {
        if (newCapacity < 1)
            throw new ArgumentException("Capacity must be at least 1", nameof(newCapacity));
        if (newCapacity < currentConfirmedCount)
            throw new InvalidOperationException(
                $"Cannot reduce capacity below current confirmed count ({currentConfirmedCount}); cancel assignments first.");
        Capacity = newCapacity;
        UpdatedAt = DateTime.UtcNow;
    }

    public void EnableWaitlist()
    {
        if (AllowWaitlist) return;
        AllowWaitlist = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void DisableWaitlist()
    {
        if (!AllowWaitlist) return;
        AllowWaitlist = false;
        UpdatedAt = DateTime.UtcNow;
    }

    public void EnableSelfSignup()
    {
        if (AllowSelfSignup) return;
        AllowSelfSignup = true;
        UpdatedAt = DateTime.UtcNow;
    }

    public void DisableSelfSignup()
    {
        if (!AllowSelfSignup) return;
        AllowSelfSignup = false;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// REQ-024 (E3.S3, post-review H-S3-6): Marks the shift cancelled. Idempotent —
    /// a second call returns silently without mutating <see cref="CancelledAt"/>.
    /// </summary>
    public void Cancel(string? reason)
    {
        if (Status == VolunteerShiftStatus.Cancelled) return;
        var trimmedReason = reason?.Trim();
        if (trimmedReason is { Length: > CancellationReasonMaxLength })
            throw new ArgumentException($"Cancellation reason cannot exceed {CancellationReasonMaxLength} characters", nameof(reason));
        Status = VolunteerShiftStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancellationReason = string.IsNullOrEmpty(trimmedReason) ? null : trimmedReason;
        UpdatedAt = DateTime.UtcNow;
    }
}
