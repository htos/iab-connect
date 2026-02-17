using IabConnect.Application.Authorization;
using IabConnect.Domain.Authorization;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-019: Event API Endpoints
/// Provides CRUD operations for events.
/// </summary>
public static class EventEndpoints
{
    public static IEndpointRouteBuilder MapEventEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/events")
            .WithTags("Events");

        // Public endpoints (no auth required for public events)
        group.MapGet("/public", GetPublicEvents)
            .WithName("GetPublicEvents")
            .WithSummary("Get public events (no authentication required)");

        group.MapGet("/public/{id:guid}", GetPublicEvent)
            .WithName("GetPublicEvent")
            .WithSummary("Get a single public event");

        // Protected endpoints (require authentication)
        group.MapGet("", GetEvents)
            .RequireAuthorization("RequireMember")
            .WithName("GetEvents")
            .WithSummary("Get all events (for authenticated users)");

        group.MapGet("/upcoming", GetUpcomingEvents)
            .RequireAuthorization("RequireMember")
            .WithName("GetUpcomingEvents")
            .WithSummary("Get upcoming events");

        group.MapGet("/{id:guid}", GetEventById)
            .RequireAuthorization("RequireMember")
            .WithName("GetEventById")
            .WithSummary("Get event by ID");

        group.MapPost("", CreateEvent)
            .RequireAuthorization("RequireVorstand")
            .WithName("CreateEvent")
            .WithSummary("Create a new event");

        group.MapPut("/{id:guid}", UpdateEvent)
            .RequireAuthorization("RequireVorstand")
            .WithName("UpdateEvent")
            .WithSummary("Update an event");

        group.MapPost("/{id:guid}/publish", PublishEvent)
            .RequireAuthorization("RequireVorstand")
            .WithName("PublishEvent")
            .WithSummary("Publish an event");

        group.MapPost("/{id:guid}/unpublish", UnpublishEvent)
            .RequireAuthorization("RequireVorstand")
            .WithName("UnpublishEvent")
            .WithSummary("Unpublish an event");

        group.MapPost("/{id:guid}/cancel", CancelEvent)
            .RequireAuthorization("RequireVorstand")
            .WithName("CancelEvent")
            .WithSummary("Cancel an event");

        group.MapDelete("/{id:guid}", DeleteEvent)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteEvent")
            .WithSummary("Delete an event");

        group.MapGet("/statistics", GetEventStatistics)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetEventStatistics")
            .WithSummary("Get event statistics");

        return app;
    }

    // === Public Endpoints ===

    private static async Task<IResult> GetPublicEvents(
        [FromQuery] DateTime? from,
        IEventRepository eventRepository,
        CancellationToken ct)
    {
        var utcFrom = from.HasValue ? DateTime.SpecifyKind(from.Value, DateTimeKind.Utc) : (DateTime?)null;
        var events = await eventRepository.GetPublicEventsAsync(utcFrom, ct);
        return Results.Ok(events.Select(MapToDto));
    }

    private static async Task<IResult> GetPublicEvent(
        Guid id,
        IEventRepository eventRepository,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        if (evt.Visibility != EventVisibility.Public || evt.Status != EventStatus.Published)
            return Results.NotFound(new { Error = "Event not found" });

        return Results.Ok(MapToDto(evt));
    }

    // === Protected Endpoints ===

    private static async Task<IResult> GetEvents(
        [FromQuery] string? search,
        [FromQuery] EventStatus? status,
        [FromQuery] EventVisibility? visibility,
        [FromQuery] EventCategory? category,
        [FromQuery] DateTime? fromDate,
        [FromQuery] DateTime? toDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        HttpContext httpContext = null!,
        IEventRepository eventRepository = null!,
        CancellationToken ct = default)
    {
        // Check if user is Vorstand or Admin - they can see all events
        var canSeeAllEvents = httpContext.User.IsInRole("vorstand") ||
                              httpContext.User.IsInRole("admin");

        // For regular members: only show Published events (unless they specifically filter by status)
        // For Vorstand/Admin: show all events
        var effectiveStatus = status;
        if (!canSeeAllEvents && !status.HasValue)
        {
            effectiveStatus = EventStatus.Published;
        }

        var filter = new EventFilterOptions
        {
            SearchTerm = search,
            Status = effectiveStatus,
            Visibility = visibility,
            Category = category,
            FromDate = fromDate.HasValue ? DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc) : null,
            ToDate = toDate.HasValue ? DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc) : null
        };

        var (items, totalCount) = await eventRepository.GetPagedAsync(filter, page, pageSize, ct);

        return Results.Ok(new
        {
            Items = items.Select(MapToDto),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    private static async Task<IResult> GetUpcomingEvents(
        [FromQuery] int count = 10,
        HttpContext httpContext = null!,
        IEventRepository eventRepository = null!,
        CancellationToken ct = default)
    {
        var events = await eventRepository.GetUpcomingAsync(count, ct);

        // For regular members: only show Published events
        var canSeeAllEvents = httpContext.User.IsInRole("vorstand") ||
                              httpContext.User.IsInRole("admin");

        if (!canSeeAllEvents)
        {
            events = events.Where(e => e.Status == EventStatus.Published).ToList();
        }

        return Results.Ok(events.Select(MapToDto));
    }

    private static async Task<IResult> GetEventById(
        Guid id,
        HttpContext httpContext,
        IEventRepository eventRepository,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        // For regular members: only allow access to Published events
        var canSeeAllEvents = httpContext.User.IsInRole("vorstand") ||
                              httpContext.User.IsInRole("admin");

        if (!canSeeAllEvents && evt.Status != EventStatus.Published)
            return Results.NotFound(new { Error = "Event not found" });

        return Results.Ok(MapToDto(evt));
    }

    private static async Task<IResult> CreateEvent(
        [FromBody] CreateEventRequest request,
        HttpContext httpContext,
        IEventRepository eventRepository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var currentUserId = authService.GetCurrentUserId(httpContext.User);

        var evt = Event.Create(
            request.Title,
            request.Description,
            request.Location,
            request.StartDate,
            request.EndDate,
            currentUserId,
            request.OrganizerName);

        // Set optional fields
        if (request.ShortDescription != null ||
            request.LocationAddress != null ||
            request.LocationUrl != null)
        {
            evt.UpdateDetails(
                request.Title,
                request.Description,
                request.ShortDescription,
                request.Location,
                request.LocationAddress,
                request.LocationUrl);
        }

        if (request.IsAllDay || request.TimeZone != null)
        {
            evt.UpdateSchedule(
                request.StartDate,
                request.EndDate,
                request.IsAllDay,
                request.TimeZone ?? "Europe/Zurich");
        }

        if (request.RegistrationRequired ||
            request.MaxParticipants.HasValue ||
            request.RegistrationDeadline.HasValue ||
            request.WaitlistEnabled)
        {
            evt.UpdateRegistrationSettings(
                request.RegistrationRequired,
                request.MaxParticipants,
                request.RegistrationDeadline,
                request.WaitlistEnabled);
        }

        if (request.Visibility.HasValue)
        {
            evt.SetVisibility(request.Visibility.Value);
        }

        if (request.Category.HasValue || request.Tags != null)
        {
            evt.UpdateCategorization(
                request.Category ?? EventCategory.General,
                request.Tags);
        }

        if (request.ImageUrl != null)
        {
            evt.UpdateImage(request.ImageUrl, request.ImageAltText);
        }

        if (request.ContactEmail != null || request.ContactPhone != null)
        {
            evt.UpdateContact(request.ContactEmail, request.ContactPhone);
        }

        if (request.Cost.HasValue || request.CostDescription != null)
        {
            evt.UpdateCost(request.Cost, request.CostDescription);
        }

        await eventRepository.AddAsync(evt, ct);
        await dbContext.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/events/{evt.Id}", MapToDto(evt));
    }

    private static async Task<IResult> UpdateEvent(
        Guid id,
        [FromBody] UpdateEventRequest request,
        IEventRepository eventRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        // Update basic details
        evt.UpdateDetails(
            request.Title,
            request.Description,
            request.ShortDescription,
            request.Location,
            request.LocationAddress,
            request.LocationUrl);

        // Update schedule
        evt.UpdateSchedule(
            request.StartDate,
            request.EndDate,
            request.IsAllDay,
            request.TimeZone ?? "Europe/Zurich");

        // Update registration settings
        evt.UpdateRegistrationSettings(
            request.RegistrationRequired,
            request.MaxParticipants,
            request.RegistrationDeadline,
            request.WaitlistEnabled);

        // Update visibility
        if (request.Visibility.HasValue)
        {
            evt.SetVisibility(request.Visibility.Value);
        }

        // Update categorization
        evt.UpdateCategorization(
            request.Category ?? EventCategory.General,
            request.Tags);

        // Update image
        evt.UpdateImage(request.ImageUrl, request.ImageAltText);

        // Update contact
        evt.UpdateContact(request.ContactEmail, request.ContactPhone);

        // Update cost
        evt.UpdateCost(request.Cost, request.CostDescription);

        eventRepository.Update(evt);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(evt));
    }

    private static async Task<IResult> PublishEvent(
        Guid id,
        IEventRepository eventRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        try
        {
            evt.Publish();
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { Error = ex.Message });
        }

        eventRepository.Update(evt);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(evt));
    }

    private static async Task<IResult> UnpublishEvent(
        Guid id,
        IEventRepository eventRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        try
        {
            evt.Unpublish();
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { Error = ex.Message });
        }

        eventRepository.Update(evt);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(evt));
    }

    private static async Task<IResult> CancelEvent(
        Guid id,
        [FromBody] CancelEventRequest? request,
        IEventRepository eventRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        evt.Cancel(request?.Reason);

        eventRepository.Update(evt);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(evt));
    }

    private static async Task<IResult> DeleteEvent(
        Guid id,
        IEventRepository eventRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);

        if (evt == null)
            return Results.NotFound(new { Error = "Event not found" });

        eventRepository.Remove(evt);
        await dbContext.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static async Task<IResult> GetEventStatistics(
        IEventRepository eventRepository,
        CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var monthStart = new DateTime(now.Year, now.Month, 1);
        var yearStart = new DateTime(now.Year, 1, 1);

        var allEvents = await eventRepository.GetAllAsync(ct);

        var stats = new
        {
            Total = allEvents.Count,
            Published = allEvents.Count(e => e.Status == EventStatus.Published),
            Draft = allEvents.Count(e => e.Status == EventStatus.Draft),
            Cancelled = allEvents.Count(e => e.Status == EventStatus.Cancelled),
            Completed = allEvents.Count(e => e.Status == EventStatus.Completed),
            Upcoming = allEvents.Count(e => e.Status == EventStatus.Published && e.StartDate > now),
            ThisMonth = allEvents.Count(e => e.StartDate >= monthStart && e.StartDate < monthStart.AddMonths(1)),
            ThisYear = allEvents.Count(e => e.StartDate >= yearStart && e.StartDate < yearStart.AddYears(1)),
            ByCategory = allEvents
                .GroupBy(e => e.Category)
                .Select(g => new { Category = g.Key.ToString(), Count = g.Count() })
                .OrderByDescending(x => x.Count)
        };

        return Results.Ok(stats);
    }

    // === DTOs ===

    private static EventDto MapToDto(Event evt) => new(
        evt.Id,
        evt.Title,
        evt.Description,
        evt.ShortDescription,
        evt.Location,
        evt.LocationAddress,
        evt.LocationUrl,
        evt.StartDate,
        evt.EndDate,
        evt.IsAllDay,
        evt.TimeZone,
        evt.IsRecurring,
        evt.RecurrencePattern,
        evt.MaxParticipants,
        evt.RegistrationRequired,
        evt.RegistrationDeadline,
        evt.WaitlistEnabled,
        evt.Visibility,
        evt.Status,
        evt.Category,
        evt.Tags,
        evt.ImageUrl,
        evt.ImageAltText,
        evt.OrganizerId,
        evt.OrganizerName,
        evt.ContactEmail,
        evt.ContactPhone,
        evt.Cost,
        evt.CostDescription,
        evt.IsFree,
        evt.CreatedAt,
        evt.UpdatedAt,
        evt.PublishedAt,
        evt.CancelledAt,
        evt.CancellationReason,
        evt.HasStarted,
        evt.HasEnded,
        evt.IsRegistrationOpen
    );
}

// === Request/Response DTOs ===

public sealed record EventDto(
    Guid Id,
    string Title,
    string Description,
    string? ShortDescription,
    string Location,
    string? LocationAddress,
    string? LocationUrl,
    DateTime StartDate,
    DateTime EndDate,
    bool IsAllDay,
    string TimeZone,
    bool IsRecurring,
    RecurrencePattern? RecurrencePattern,
    int? MaxParticipants,
    bool RegistrationRequired,
    DateTime? RegistrationDeadline,
    bool WaitlistEnabled,
    EventVisibility Visibility,
    EventStatus Status,
    EventCategory Category,
    List<string> Tags,
    string? ImageUrl,
    string? ImageAltText,
    Guid? OrganizerId,
    string? OrganizerName,
    string? ContactEmail,
    string? ContactPhone,
    decimal? Cost,
    string? CostDescription,
    bool IsFree,
    DateTime CreatedAt,
    DateTime? UpdatedAt,
    DateTime? PublishedAt,
    DateTime? CancelledAt,
    string? CancellationReason,
    bool HasStarted,
    bool HasEnded,
    bool IsRegistrationOpen
);

public sealed record CreateEventRequest(
    string Title,
    string Description,
    string Location,
    DateTime StartDate,
    DateTime EndDate,
    string? ShortDescription = null,
    string? LocationAddress = null,
    string? LocationUrl = null,
    bool IsAllDay = false,
    string? TimeZone = null,
    int? MaxParticipants = null,
    bool RegistrationRequired = false,
    DateTime? RegistrationDeadline = null,
    bool WaitlistEnabled = false,
    EventVisibility? Visibility = null,
    EventCategory? Category = null,
    List<string>? Tags = null,
    string? ImageUrl = null,
    string? ImageAltText = null,
    string? OrganizerName = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    decimal? Cost = null,
    string? CostDescription = null
);

public sealed record UpdateEventRequest(
    string Title,
    string Description,
    string Location,
    DateTime StartDate,
    DateTime EndDate,
    string? ShortDescription = null,
    string? LocationAddress = null,
    string? LocationUrl = null,
    bool IsAllDay = false,
    string? TimeZone = null,
    int? MaxParticipants = null,
    bool RegistrationRequired = false,
    DateTime? RegistrationDeadline = null,
    bool WaitlistEnabled = false,
    EventVisibility? Visibility = null,
    EventCategory? Category = null,
    List<string>? Tags = null,
    string? ImageUrl = null,
    string? ImageAltText = null,
    string? ContactEmail = null,
    string? ContactPhone = null,
    decimal? Cost = null,
    string? CostDescription = null
);

public sealed record CancelEventRequest(string? Reason);
