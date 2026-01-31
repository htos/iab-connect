using IabConnect.Domain.Events;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using System.Security.Claims;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-020: Event Registration/RSVP API Endpoints
/// </summary>
public static class EventRegistrationEndpoints
{
    public static IEndpointRouteBuilder MapEventRegistrationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/v1/events/{eventId:guid}/registrations")
            .WithTags("Event Registrations");

        // Public endpoints (for public events)
        group.MapPost("/public", RegisterPublic)
            .WithName("RegisterPublicEvent")
            .WithSummary("Öffentliche Anmeldung für ein Event")
            .Produces<EventRegistrationDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        // Protected endpoints
        var protectedGroup = group.RequireAuthorization();

        protectedGroup.MapGet("/", GetRegistrations)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("GetEventRegistrations")
            .WithSummary("Alle Anmeldungen für ein Event abrufen")
            .Produces<PagedResult<EventRegistrationDto>>();

        protectedGroup.MapGet("/{registrationId:guid}", GetRegistration)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("GetEventRegistration")
            .WithSummary("Eine Anmeldung per ID abrufen")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/", RegisterMember)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "member"))
            .WithName("RegisterForEvent")
            .WithSummary("Als Mitglied für ein Event anmelden")
            .Produces<EventRegistrationDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status409Conflict);

        protectedGroup.MapPut("/{registrationId:guid}", UpdateRegistration)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("UpdateEventRegistration")
            .WithSummary("Eine Anmeldung aktualisieren")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/cancel", CancelRegistration)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "member"))
            .WithName("CancelEventRegistration")
            .WithSummary("Eine Anmeldung stornieren")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/confirm", ConfirmRegistration)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("ConfirmEventRegistration")
            .WithSummary("Eine ausstehende Anmeldung bestätigen")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/check-in", CheckInRegistration)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("CheckInEventRegistration")
            .WithSummary("Teilnehmer beim Event einchecken")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/no-show", MarkAsNoShow)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("MarkEventRegistrationNoShow")
            .WithSummary("Teilnehmer als No-Show markieren")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapGet("/statistics", GetStatistics)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("GetEventRegistrationStatistics")
            .WithSummary("Statistiken für Event-Anmeldungen")
            .Produces<EventRegistrationStatistics>();

        protectedGroup.MapGet("/waitlist", GetWaitlist)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("GetEventWaitlist")
            .WithSummary("Warteliste für ein Event abrufen")
            .Produces<IReadOnlyList<EventRegistrationDto>>();

        protectedGroup.MapPost("/promote-from-waitlist", PromoteFromWaitlist)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithName("PromoteFromWaitlist")
            .WithSummary("Nächste Person von der Warteliste nachrücken lassen")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        // QR Code check-in endpoint
        endpoints.MapPost("/api/v1/registrations/check-in/{qrCodeToken}", CheckInByQrCode)
            .RequireAuthorization(policy => policy.RequireRole("admin", "vorstand", "event-manager"))
            .WithTags("Event Registrations")
            .WithName("CheckInByQrCode")
            .WithSummary("Check-in per QR-Code")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        // My registrations endpoint
        endpoints.MapGet("/api/v1/my-registrations", GetMyRegistrations)
            .RequireAuthorization()
            .WithTags("Event Registrations")
            .WithName("GetMyRegistrations")
            .WithSummary("Eigene Event-Anmeldungen abrufen")
            .Produces<IReadOnlyList<EventRegistrationDto>>();

        return endpoints;
    }

    private static async Task<IResult> RegisterPublic(
        Guid eventId,
        RegisterPublicRequest request,
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository)
    {
        var evt = await eventRepository.GetByIdAsync(eventId);
        if (evt == null)
            return Results.NotFound(new { message = "Event not found" });

        if (evt.Visibility != EventVisibility.Public)
            return Results.BadRequest(new { message = "Event is not public" });

        if (evt.Status != EventStatus.Published)
            return Results.BadRequest(new { message = "Event is not published" });

        if (!evt.RegistrationRequired)
            return Results.BadRequest(new { message = "Event does not require registration" });

        if (evt.RegistrationDeadline.HasValue && DateTime.UtcNow > evt.RegistrationDeadline.Value)
            return Results.BadRequest(new { message = "Registration deadline has passed" });

        // Check for existing registration
        var exists = await registrationRepository.ExistsByEmailAsync(eventId, request.Email);
        if (exists)
            return Results.Conflict(new { message = "Email is already registered for this event" });

        // Check capacity
        var totalParticipants = await registrationRepository.CountTotalParticipantsAsync(eventId);
        var isWaitlisted = evt.MaxParticipants.HasValue && totalParticipants + request.NumberOfGuests > evt.MaxParticipants.Value;

        EventRegistration registration;
        if (isWaitlisted && evt.WaitlistEnabled)
        {
            var waitlistPosition = await registrationRepository.CountWaitlistedAsync(eventId) + 1;
            registration = EventRegistration.CreateWaitlisted(
                eventId,
                null,
                null,
                request.Name,
                request.Email,
                waitlistPosition,
                request.NumberOfGuests,
                request.Phone,
                request.SpecialRequirements);
        }
        else if (isWaitlisted)
        {
            return Results.BadRequest(new { message = "Event is fully booked" });
        }
        else
        {
            registration = EventRegistration.CreateForGuest(
                eventId,
                request.Name,
                request.Email,
                request.NumberOfGuests,
                request.Phone,
                request.SpecialRequirements);
        }

        await registrationRepository.AddAsync(registration);

        return Results.Created(
            $"/api/v1/events/{eventId}/registrations/{registration.Id}",
            MapToDto(registration));
    }

    private static async Task<IResult> RegisterMember(
        Guid eventId,
        RegisterMemberRequest request,
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository,
        ClaimsPrincipal user)
    {
        var evt = await eventRepository.GetByIdAsync(eventId);
        if (evt == null)
            return Results.NotFound(new { message = "Event not found" });

        if (evt.Status != EventStatus.Published)
            return Results.BadRequest(new { message = "Event is not published" });

        if (!evt.RegistrationRequired)
            return Results.BadRequest(new { message = "Event does not require registration" });

        if (evt.RegistrationDeadline.HasValue && DateTime.UtcNow > evt.RegistrationDeadline.Value)
            return Results.BadRequest(new { message = "Registration deadline has passed" });

        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
            return Results.BadRequest(new { message = "User ID not found" });

        // Check for existing registration
        var exists = await registrationRepository.ExistsAsync(eventId, userId);
        if (exists)
            return Results.Conflict(new { message = "You are already registered for this event" });

        // Get user name and email from claims
        var userName = user.FindFirst("name")?.Value
                    ?? user.FindFirst(ClaimTypes.Name)?.Value
                    ?? request.Name;
        var userEmail = user.FindFirst(ClaimTypes.Email)?.Value
                     ?? user.FindFirst("email")?.Value
                     ?? request.Email;

        if (string.IsNullOrEmpty(userName) || string.IsNullOrEmpty(userEmail))
            return Results.BadRequest(new { message = "Name and email are required" });

        // Check capacity
        var totalParticipants = await registrationRepository.CountTotalParticipantsAsync(eventId);
        var isWaitlisted = evt.MaxParticipants.HasValue && totalParticipants + request.NumberOfGuests > evt.MaxParticipants.Value;

        EventRegistration registration;
        if (isWaitlisted && evt.WaitlistEnabled)
        {
            var waitlistPosition = await registrationRepository.CountWaitlistedAsync(eventId) + 1;
            registration = EventRegistration.CreateWaitlisted(
                eventId,
                userId,
                request.MemberId,
                userName,
                userEmail,
                waitlistPosition,
                request.NumberOfGuests,
                request.Phone,
                request.SpecialRequirements);
        }
        else if (isWaitlisted)
        {
            return Results.BadRequest(new { message = "Event is fully booked" });
        }
        else
        {
            registration = EventRegistration.CreateForMember(
                eventId,
                userId,
                request.MemberId ?? Guid.Empty,
                userName,
                userEmail,
                request.NumberOfGuests,
                request.Phone,
                request.SpecialRequirements);
        }

        await registrationRepository.AddAsync(registration);

        return Results.Created(
            $"/api/v1/events/{eventId}/registrations/{registration.Id}",
            MapToDto(registration));
    }

    private static async Task<IResult> GetRegistrations(
        Guid eventId,
        IEventRegistrationRepository registrationRepository,
        RegistrationStatus? status = null,
        bool? isWaitlisted = null,
        string? searchTerm = null,
        int page = 1,
        int pageSize = 20)
    {
        var filter = new EventRegistrationFilterOptions
        {
            Status = status,
            IsWaitlisted = isWaitlisted,
            SearchTerm = searchTerm
        };

        var (items, totalCount) = await registrationRepository.GetPagedAsync(
            eventId, filter, page, pageSize);

        return Results.Ok(new PagedResult<EventRegistrationDto>
        {
            Items = items.Select(MapToDto).ToList(),
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    private static async Task<IResult> GetRegistration(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> UpdateRegistration(
        Guid eventId,
        Guid registrationId,
        UpdateRegistrationRequest request,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        registration.UpdateDetails(
            request.ParticipantName,
            request.ParticipantEmail,
            request.ParticipantPhone,
            request.NumberOfGuests,
            request.SpecialRequirements,
            request.Notes);

        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> CancelRegistration(
        Guid eventId,
        Guid registrationId,
        CancelRegistrationRequest? request,
        IEventRegistrationRepository registrationRepository,
        IEventRepository eventRepository,
        ClaimsPrincipal user)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        var isOwner = registration.UserId.HasValue &&
                      Guid.TryParse(userIdClaim, out var userId) &&
                      registration.UserId.Value == userId;
        var isAdmin = user.IsInRole("admin") || user.IsInRole("vorstand") || user.IsInRole("event-manager");

        if (!isOwner && !isAdmin)
            return Results.Forbid();

        registration.Cancel(request?.Reason, cancelledByParticipant: isOwner && !isAdmin);
        await registrationRepository.UpdateAsync(registration);

        // If waitlist is enabled, promote next person
        var evt = await eventRepository.GetByIdAsync(eventId);
        if (evt != null && evt.WaitlistEnabled)
        {
            var nextOnWaitlist = await registrationRepository.GetNextOnWaitlistAsync(eventId);
            if (nextOnWaitlist != null)
            {
                nextOnWaitlist.PromoteFromWaitlist();
                await registrationRepository.UpdateAsync(nextOnWaitlist);
                // TODO: Send notification to promoted person
            }
        }

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> ConfirmRegistration(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        registration.Confirm();
        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> CheckInRegistration(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository,
        ClaimsPrincipal user)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdClaim, out var checkedInBy))
            return Results.BadRequest(new { message = "User ID not found" });

        registration.CheckIn(checkedInBy);
        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> MarkAsNoShow(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        registration.MarkAsNoShow();
        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> GetStatistics(
        Guid eventId,
        IEventRegistrationRepository registrationRepository)
    {
        var statistics = await registrationRepository.GetStatisticsAsync(eventId);
        return Results.Ok(statistics);
    }

    private static async Task<IResult> GetWaitlist(
        Guid eventId,
        IEventRegistrationRepository registrationRepository)
    {
        var waitlist = await registrationRepository.GetWaitlistAsync(eventId);
        return Results.Ok(waitlist.Select(MapToDto).ToList());
    }

    private static async Task<IResult> PromoteFromWaitlist(
        Guid eventId,
        IEventRegistrationRepository registrationRepository)
    {
        var nextOnWaitlist = await registrationRepository.GetNextOnWaitlistAsync(eventId);
        if (nextOnWaitlist == null)
            return Results.NotFound(new { message = "No one on waitlist" });

        nextOnWaitlist.PromoteFromWaitlist();
        await registrationRepository.UpdateAsync(nextOnWaitlist);
        // TODO: Send notification

        // Update remaining waitlist positions
        var remainingWaitlist = await registrationRepository.GetWaitlistAsync(eventId);
        foreach (var item in remainingWaitlist)
        {
            if (item.WaitlistPosition > 1)
            {
                item.UpdateWaitlistPosition(item.WaitlistPosition.Value - 1);
                await registrationRepository.UpdateAsync(item);
            }
        }

        return Results.Ok(MapToDto(nextOnWaitlist));
    }

    private static async Task<IResult> CheckInByQrCode(
        string qrCodeToken,
        IEventRegistrationRepository registrationRepository,
        ClaimsPrincipal user)
    {
        var registration = await registrationRepository.GetByQrCodeTokenAsync(qrCodeToken);
        if (registration == null)
            return Results.NotFound(new { message = "Invalid QR code" });

        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdClaim, out var checkedInBy))
            return Results.BadRequest(new { message = "User ID not found" });

        registration.CheckIn(checkedInBy);
        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> GetMyRegistrations(
        IEventRegistrationRepository registrationRepository,
        ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.BadRequest(new { message = "User ID not found" });

        var registrations = await registrationRepository.GetByUserIdAsync(userId);
        return Results.Ok(registrations.Select(MapToDto).ToList());
    }

    private static EventRegistrationDto MapToDto(EventRegistration r) => new()
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
        IsCheckedIn = r.IsCheckedIn
    };
}

// Request/Response DTOs
public record RegisterPublicRequest(
    string Name,
    string Email,
    string? Phone = null,
    int NumberOfGuests = 1,
    string? SpecialRequirements = null);

public record RegisterMemberRequest(
    string? Name = null,
    string? Email = null,
    string? Phone = null,
    Guid? MemberId = null,
    int NumberOfGuests = 1,
    string? SpecialRequirements = null);

public record UpdateRegistrationRequest(
    string ParticipantName,
    string ParticipantEmail,
    string? ParticipantPhone,
    int NumberOfGuests,
    string? SpecialRequirements,
    string? Notes);

public record CancelRegistrationRequest(string? Reason = null);

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
}

public record PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages { get; init; }
}
