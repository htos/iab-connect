namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-019: Event visibility options
/// </summary>
public enum EventVisibility
{
    /// <summary>
    /// Only members can see this event
    /// </summary>
    MembersOnly = 0,

    /// <summary>
    /// Everyone can see this event (public page)
    /// </summary>
    Public = 1,

    /// <summary>
    /// Only invited members can see this event
    /// </summary>
    InviteOnly = 2,

    /// <summary>
    /// Only visible to admins/organizers (hidden)
    /// </summary>
    Hidden = 3
}

/// <summary>
/// REQ-019: Event status
/// </summary>
public enum EventStatus
{
    /// <summary>
    /// Event is being prepared (not visible)
    /// </summary>
    Draft = 0,

    /// <summary>
    /// Event is published and visible
    /// </summary>
    Published = 1,

    /// <summary>
    /// Event was cancelled
    /// </summary>
    Cancelled = 2,

    /// <summary>
    /// Event has finished
    /// </summary>
    Completed = 3
}

/// <summary>
/// REQ-019: Event categories
/// </summary>
public enum EventCategory
{
    General = 0,
    Cultural = 1,
    Social = 2,
    Educational = 3,
    Sports = 4,
    Religious = 5,
    Charity = 6,
    Meeting = 7,
    Workshop = 8,
    Festival = 9,
    Other = 99
}

/// <summary>
/// REQ-019: Recurrence pattern for series events
/// </summary>
public enum RecurrencePattern
{
    Daily = 0,
    Weekly = 1,
    BiWeekly = 2,
    Monthly = 3,
    Yearly = 4
}
