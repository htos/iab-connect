using System.Security.Claims;
using IabConnect.Api.Authorization;
using IabConnect.Application.Authorization;
using IabConnect.Application.Events.Calendar;
using IabConnect.Domain.Authorization;
using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;

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

        // REQ-025 (E3.S5): Calendar feed endpoints (RFC 5545 ICS)
        group.MapGet("/calendar.ics", GetPublicCalendar)
            .WithName("GetPublicCalendarIcs")
            .WithSummary("Public calendar feed (no authentication)");

        group.MapGet("/my-calendar.ics", GetMemberCalendar)
            .WithName("GetMemberCalendarIcs")
            .WithSummary("Per-member calendar feed via opaque token");

        group.MapGet("/{id:guid}/calendar.ics", GetSingleEventCalendar)
            .WithName("GetSingleEventCalendarIcs")
            .WithSummary("Per-event ICS download");

        group.MapPost("/calendar/token/rotate", RotateCalendarToken)
            .RequireAuthorization("RequireMember")
            .WithName("RotateCalendarToken")
            .WithSummary("Generate a new calendar-subscription token for the calling member");

        group.MapDelete("/calendar/token", RevokeCalendarToken)
            .RequireAuthorization("RequireMember")
            .WithName("RevokeCalendarToken")
            .WithSummary("Revoke the calling member's calendar-subscription token");

        return app;
    }

    // === REQ-025 (E3.S5) Calendar feed handlers ===

    private static string ResolveBaseUrl(IConfiguration config)
    {
        // REQ-025 (E3.S5 post-review M-S5-6): fail loud rather than embed `https://localhost`
        // URLs into ICS feeds that subscribers will then bookmark in their calendar clients.
        // A misconfigured deployment is better surfaced as a 500 on the first feed fetch than
        // as a silent corruption of every emitted subscription URL.
        //
        // REQ-025 (E3.S5 Round-3 R3-M-S5-6): validate URL shape — reject anything that would
        // produce a malformed URL embedded in the ICS body (CRLF would break line folding;
        // non-http(s) schemes never make sense for a public-feed URL). Done at request time
        // rather than at startup because IOptions<T>.ValidateOnStart() requires a typed
        // options class which is a heavier refactor than this story can carry. The validation
        // is idempotent and trivially cached by ASP.NET's IConfiguration providers.
        var configured = config["App:PublicBaseUrl"];
        if (string.IsNullOrWhiteSpace(configured))
            throw new InvalidOperationException(
                "App:PublicBaseUrl is not configured. Calendar feeds embed this URL in every ICS body; refusing to fall back to localhost.");
        if (!Uri.TryCreate(configured, UriKind.Absolute, out var uri)
            || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
        {
            throw new InvalidOperationException(
                $"App:PublicBaseUrl ('{configured}') is not a valid absolute http(s) URL; calendar feeds would embed a malformed value.");
        }
        if (configured.Contains('\r') || configured.Contains('\n'))
        {
            throw new InvalidOperationException(
                "App:PublicBaseUrl must not contain CR/LF; calendar feeds would inject those bytes into the ICS body and break line folding.");
        }
        return configured;
    }

    // REQ-025 (E3.S5 post-review M-S5-3): the public feed can stay `public, max-age=600`;
    // the per-member token-bearing feed MUST be `private` so CDN/proxy caches don't serve
    // one member's ICS to another (they share the same URL path with only the query token
    // differing, which some intermediaries normalize away).
    private static void SetPublicIcsResponseHeaders(HttpResponse response)
    {
        response.Headers.CacheControl = "public, max-age=600, stale-while-revalidate=300";
        // REQ-025 (E3.S5 Round-3 R3-M-S5-3): Vary: Accept-Encoding so a gzip-vs-identity client
        // doesn't get a cached response in the wrong encoding from a downstream CDN. The ETag
        // wiring is deferred — adding stable ETag derivation requires hashing the body, which
        // would force materialization before headers go out and erase the gzip benefit. The
        // Vary header is the immediate fix; ETag is tracked as a future optimization.
        response.Headers.Vary = "Accept-Encoding";
    }

    private static void SetPrivateIcsResponseHeaders(HttpResponse response)
    {
        response.Headers.CacheControl = "private, no-store";
    }

    private static async Task<IResult> GetPublicCalendar(
        ISender sender,
        IConfiguration config,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var feed = await sender.Send(new GetPublicCalendarFeedQuery(ResolveBaseUrl(config)), ct);
        SetPublicIcsResponseHeaders(httpContext.Response);
        return Results.Text(feed.IcsContent, "text/calendar; charset=utf-8");
    }

    private static async Task<IResult> GetMemberCalendar(
        [FromQuery] string? token,
        ISender sender,
        IConfiguration config,
        HttpContext httpContext,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(token))
            return Results.NotFound(new { message = "Calendar feed not found" });

        var feed = await sender.Send(new GetMemberCalendarFeedQuery(token, ResolveBaseUrl(config)), ct);
        if (feed is null)
            return Results.NotFound(new { message = "Calendar feed not found" });

        // Post-review M-S5-3: token-bearing feed is per-member; never let CDNs cache it.
        SetPrivateIcsResponseHeaders(httpContext.Response);
        return Results.Text(feed.IcsContent, "text/calendar; charset=utf-8");
    }

    private static async Task<IResult> GetSingleEventCalendar(
        Guid id,
        [FromQuery] string? token,
        IEventRepository eventRepository,
        IMemberRepository memberRepository,
        ICalendarFeedBuilder builder,
        IConfiguration config,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var evt = await eventRepository.GetByIdAsync(id, ct);
        if (evt is null || evt.IsDeleted || evt.Status != EventStatus.Published)
            return Results.NotFound(new { message = "Calendar feed not found" });

        if (evt.Visibility == EventVisibility.Public)
        {
            // OK — anonymous download.
        }
        else if (evt.Visibility == EventVisibility.MembersOnly)
        {
            // Token required; resolve to member.
            if (string.IsNullOrWhiteSpace(token))
                return Results.NotFound(new { message = "Calendar feed not found" });
            var member = await memberRepository.GetByCalendarTokenAsync(token, ct);
            if (member is null)
                return Results.NotFound(new { message = "Calendar feed not found" });
        }
        else
        {
            // Hidden / InviteOnly never available via the calendar feed.
            return Results.NotFound(new { message = "Calendar feed not found" });
        }

        var ics = builder.BuildSingle(evt, ResolveBaseUrl(config));
        // Post-review M-S5-3: single-event endpoint may also carry a token (for MembersOnly).
        // Treat it as private in that case; public visibility can stay cacheable.
        if (evt.Visibility == EventVisibility.MembersOnly)
            SetPrivateIcsResponseHeaders(httpContext.Response);
        else
            SetPublicIcsResponseHeaders(httpContext.Response);
        return Results.Text(ics, "text/calendar; charset=utf-8");
    }

    private static async Task<IResult> RotateCalendarToken(
        ICalendarTokenService calendarTokenService,
        ISecurityAuditLogger auditLogger,
        IConfiguration config,
        ClaimsPrincipal user,
        HttpContext httpContext,
        CancellationToken ct)
    {
        var keycloakId = ResolveKeycloakUserId(user);
        if (keycloakId is null)
            return Results.Forbid();

        // REQ-025 (E3.S5 Round-3 R3-H-S5-5 / Epic-3-retro §9): the rotate now runs inside a
        // FOR UPDATE-locked transaction (ICalendarTokenService). Concurrent rotate calls from
        // the same member serialise, so the cleartext token returned here always matches the
        // hash that was persisted — the previous double-rotate race (two responses, only the
        // last write matches) is closed.
        var result = await calendarTokenService.RotateAsync(keycloakId.Value, ct);
        if (!result.MemberFound || result.Token is null)
            return Results.Json(
                new { message = "Calendar feed requires an active membership" },
                statusCode: StatusCodes.Status403Forbidden);

        auditLogger.LogAccessGranted(user, "Member", "CalendarTokenRotated", result.MemberId.ToString());

        // REQ-025 (E3.S5 Round-3 R3-M-S5-7): the response contains the brand-new cleartext
        // token (the only time it is ever exposed). Must never be cached by intermediaries.
        httpContext.Response.Headers.CacheControl = "no-store";

        var subscriptionUrl = $"{ResolveBaseUrl(config).TrimEnd('/')}/api/v1/events/my-calendar.ics?token={Uri.EscapeDataString(result.Token)}";
        return Results.Ok(new { token = result.Token, subscriptionUrl });
    }

    private static async Task<IResult> RevokeCalendarToken(
        ICalendarTokenService calendarTokenService,
        ISecurityAuditLogger auditLogger,
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        var keycloakId = ResolveKeycloakUserId(user);
        if (keycloakId is null)
            return Results.Forbid();

        // REQ-025 (Epic-3-retro §9): revoke also runs under the FOR UPDATE row lock so it
        // serialises against a concurrent rotate on the same member row.
        var revoked = await calendarTokenService.RevokeAsync(keycloakId.Value, ct);
        if (!revoked)
            return Results.Json(
                new { message = "Calendar feed requires an active membership" },
                statusCode: StatusCodes.Status403Forbidden);

        auditLogger.LogAccessGranted(user, "Member", "CalendarTokenRevoked", keycloakId.Value.ToString());
        return Results.NoContent();
    }

    private static Guid? ResolveKeycloakUserId(ClaimsPrincipal user)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out var id) ? id : null;
    }

    // === Public Endpoints ===

    private static async Task<IResult> GetPublicEvents(
        [FromQuery] DateTime? from,
        IEventRepository eventRepository,
        CancellationToken ct)
    {
        var utcFrom = from.HasValue ? DateTime.SpecifyKind(from.Value, DateTimeKind.Utc) : (DateTime?)null;
        var events = await eventRepository.GetPublicEventsAsync(utcFrom, ct: ct);
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
        var canSeeAllEvents = httpContext.User.IsInRole(Roles.Vorstand) ||
                              httpContext.User.IsInRole(Roles.Admin);

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
        var canSeeAllEvents = httpContext.User.IsInRole(Roles.Vorstand) ||
                              httpContext.User.IsInRole(Roles.Admin);

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
        var canSeeAllEvents = httpContext.User.IsInRole(Roles.Vorstand) ||
                              httpContext.User.IsInRole(Roles.Admin);

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
