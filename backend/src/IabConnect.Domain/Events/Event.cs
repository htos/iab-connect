using IabConnect.Domain.Common;

namespace IabConnect.Domain.Events;

/// <summary>
/// REQ-019: Event-Entity für die Eventverwaltung
/// Repräsentiert ein Vereinsevent mit allen Details.
/// </summary>
public sealed class Event : Entity
{
    public string Title { get; private set; } = string.Empty;
    public string Description { get; private set; } = string.Empty;
    public string? ShortDescription { get; private set; }

    // Location
    public string Location { get; private set; } = string.Empty;
    public string? LocationAddress { get; private set; }
    public string? LocationUrl { get; private set; } // For online events

    // Date and Time
    public DateTime StartDate { get; private set; }
    public DateTime EndDate { get; private set; }
    public bool IsAllDay { get; private set; }
    public string TimeZone { get; private set; } = "Europe/Zurich";

    // Series/Recurring Events
    public bool IsRecurring { get; private set; }
    public RecurrencePattern? RecurrencePattern { get; private set; }
    public Guid? ParentEventId { get; private set; } // For series instances

    // Capacity and Registration
    public int? MaxParticipants { get; private set; }
    public bool RegistrationRequired { get; private set; }
    public DateTime? RegistrationDeadline { get; private set; }
    public bool WaitlistEnabled { get; private set; }

    // Visibility and Status
    public EventVisibility Visibility { get; private set; } = EventVisibility.MembersOnly;
    public EventStatus Status { get; private set; } = EventStatus.Draft;

    // Categorization
    public EventCategory Category { get; private set; } = EventCategory.General;
    public List<string> Tags { get; private set; } = new();

    // Media
    public string? ImageUrl { get; private set; }
    public string? ImageAltText { get; private set; }

    // Organizer
    public Guid? OrganizerId { get; private set; } // Member who created the event
    public string? OrganizerName { get; private set; }
    public string? ContactEmail { get; private set; }
    public string? ContactPhone { get; private set; }

    // Cost
    public decimal? Cost { get; private set; }
    public string? CostDescription { get; private set; }
    public bool IsFree => !Cost.HasValue || Cost.Value == 0;

    // Content language (ISO 639-1, e.g. "de"/"en"/"hi"; null = organization default) — REQ-055 (E7-S4)
    public string? ContentLanguage { get; private set; }

    // Audit
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public DateTime? PublishedAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public string? CancellationReason { get; private set; }

    // Soft delete
    public bool IsDeleted { get; private set; }
    public DateTime? DeletedAt { get; private set; }

    private Event() { }

    /// <summary>
    /// Factory method to create a new event.
    /// </summary>
    public static Event Create(
        string title,
        string description,
        string location,
        DateTime startDate,
        DateTime endDate,
        Guid? organizerId = null,
        string? organizerName = null)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required", nameof(title));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required", nameof(description));
        if (string.IsNullOrWhiteSpace(location))
            throw new ArgumentException("Location is required", nameof(location));
        if (endDate < startDate)
            throw new ArgumentException("End date cannot be before start date", nameof(endDate));

        return new Event
        {
            Id = Guid.NewGuid(),
            Title = title.Trim(),
            Description = description.Trim(),
            Location = location.Trim(),
            StartDate = DateTimeUtcGuard.EnsureUtc(startDate),
            EndDate = DateTimeUtcGuard.EnsureUtc(endDate),
            OrganizerId = organizerId,
            OrganizerName = organizerName,
            Status = EventStatus.Draft,
            Visibility = EventVisibility.MembersOnly,
            CreatedAt = DateTime.UtcNow
        };
    }

    /// <summary>
    /// Updates the basic event details.
    /// </summary>
    public void UpdateDetails(
        string title,
        string description,
        string? shortDescription,
        string location,
        string? locationAddress,
        string? locationUrl)
    {
        if (string.IsNullOrWhiteSpace(title))
            throw new ArgumentException("Title is required", nameof(title));
        if (string.IsNullOrWhiteSpace(description))
            throw new ArgumentException("Description is required", nameof(description));
        if (string.IsNullOrWhiteSpace(location))
            throw new ArgumentException("Location is required", nameof(location));

        Title = title.Trim();
        Description = description.Trim();
        ShortDescription = shortDescription?.Trim();
        Location = location.Trim();
        LocationAddress = locationAddress?.Trim();
        LocationUrl = locationUrl?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the date and time settings.
    /// </summary>
    public void UpdateSchedule(
        DateTime startDate,
        DateTime endDate,
        bool isAllDay,
        string timeZone)
    {
        if (endDate < startDate)
            throw new ArgumentException("End date cannot be before start date", nameof(endDate));

        StartDate = DateTimeUtcGuard.EnsureUtc(startDate);
        EndDate = DateTimeUtcGuard.EnsureUtc(endDate);
        IsAllDay = isAllDay;
        TimeZone = timeZone;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the registration settings.
    /// </summary>
    public void UpdateRegistrationSettings(
        bool registrationRequired,
        int? maxParticipants,
        DateTime? registrationDeadline,
        bool waitlistEnabled)
    {
        if (maxParticipants.HasValue && maxParticipants.Value < 0)
            throw new ArgumentException("Max participants cannot be negative", nameof(maxParticipants));

        RegistrationRequired = registrationRequired;
        MaxParticipants = maxParticipants;
        RegistrationDeadline = DateTimeUtcGuard.EnsureUtc(registrationDeadline);
        WaitlistEnabled = waitlistEnabled;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the visibility setting.
    /// </summary>
    public void SetVisibility(EventVisibility visibility)
    {
        Visibility = visibility;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the category and tags.
    /// </summary>
    public void UpdateCategorization(EventCategory category, List<string>? tags)
    {
        Category = category;
        Tags = tags?.Select(t => t.Trim()).Where(t => !string.IsNullOrEmpty(t)).ToList() ?? new List<string>();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the event image.
    /// </summary>
    public void UpdateImage(string? imageUrl, string? imageAltText)
    {
        ImageUrl = imageUrl;
        ImageAltText = imageAltText;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the contact information.
    /// </summary>
    public void UpdateContact(string? contactEmail, string? contactPhone)
    {
        ContactEmail = contactEmail?.Trim();
        ContactPhone = contactPhone?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Updates the cost information.
    /// </summary>
    public void UpdateCost(decimal? cost, string? costDescription)
    {
        if (cost.HasValue && cost.Value < 0)
            throw new ArgumentException("Cost cannot be negative", nameof(cost));

        Cost = cost;
        CostDescription = costDescription?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Sets the content language (ISO 639-1, e.g. "de"/"en"/"hi"; null = use the
    /// organization default). Validated against the supported set at the write
    /// boundary (REQ-055, E7-S4); an unsupported code throws.
    /// </summary>
    public void SetContentLanguage(string? contentLanguage)
    {
        ContentLanguage = ContentLanguages.Normalize(contentLanguage);
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Publishes the event (makes it visible according to visibility setting).
    /// </summary>
    public void Publish()
    {
        if (Status == EventStatus.Published)
            throw new InvalidOperationException("Event is already published");
        if (Status == EventStatus.Cancelled)
            throw new InvalidOperationException("Cannot publish a cancelled event");

        Status = EventStatus.Published;
        PublishedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Unpublishes the event (back to draft).
    /// </summary>
    public void Unpublish()
    {
        if (Status != EventStatus.Published)
            throw new InvalidOperationException("Event is not published");
        if (Status == EventStatus.Cancelled)
            throw new InvalidOperationException("Cannot unpublish a cancelled event");

        Status = EventStatus.Draft;
        PublishedAt = null;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Cancels the event.
    /// </summary>
    public void Cancel(string? reason)
    {
        if (Status == EventStatus.Cancelled)
            throw new InvalidOperationException("Event is already cancelled");

        Status = EventStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
        CancellationReason = reason?.Trim();
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Marks the event as completed.
    /// </summary>
    public void Complete()
    {
        if (Status != EventStatus.Published)
            throw new InvalidOperationException("Only published events can be completed");
        if (Status == EventStatus.Cancelled)
            throw new InvalidOperationException("Cannot complete a cancelled event");

        Status = EventStatus.Completed;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Soft deletes the event.
    /// </summary>
    public void Delete()
    {
        if (IsDeleted)
            throw new InvalidOperationException("Event is already deleted");

        IsDeleted = true;
        DeletedAt = DateTime.UtcNow;
        UpdatedAt = DateTime.UtcNow;
    }

    /// <summary>
    /// Checks if the event has started.
    /// </summary>
    public bool HasStarted => DateTime.UtcNow >= StartDate;

    /// <summary>
    /// Checks if the event has ended.
    /// </summary>
    public bool HasEnded => DateTime.UtcNow >= EndDate;

    /// <summary>
    /// Checks if registration is still open.
    /// </summary>
    public bool IsRegistrationOpen =>
        RegistrationRequired &&
        Status == EventStatus.Published &&
        !HasEnded &&
        (!RegistrationDeadline.HasValue || DateTime.UtcNow < RegistrationDeadline.Value);
}
