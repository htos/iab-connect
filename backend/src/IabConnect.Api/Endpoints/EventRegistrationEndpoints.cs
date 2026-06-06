using IabConnect.Api.Authorization;
using IabConnect.Application.Common;
using IabConnect.Application.Events;
using IabConnect.Application.Events.CheckIn;
using IabConnect.Application.Events.PaidRegistration;
using IabConnect.Application.Finance;
using IabConnect.Domain.Common;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using MediatR;
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

        // Protected endpoints — also behind the Events module gate (REQ-087, E10-S3). The
        // public RSVP endpoint below stays on `group` with .AllowAnonymous() and is not gated.
        var protectedGroup = group.RequireAuthorization().RequireAuthorization("Module:events");

        // Public endpoints MUST be mapped after RequireAuthorization and use AllowAnonymous
        // to override the group-level auth requirement
        group.MapPost("/public", RegisterPublic)
            .AllowAnonymous()
            .RequireModule("public_view") // REQ-087 (E10-S5): public RSVP gated by public_view
            .WithName("RegisterPublicEvent")
            .WithSummary("Öffentliche Anmeldung für ein Event")
            .Produces<EventRegistrationDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        protectedGroup.MapGet("/", GetRegistrations)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("GetEventRegistrations")
            .WithSummary("Alle Anmeldungen für ein Event abrufen")
            .Produces<PagedResult<EventRegistrationDto>>();

        protectedGroup.MapGet("/{registrationId:guid}", GetRegistration)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("GetEventRegistration")
            .WithSummary("Eine Anmeldung per ID abrufen")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/", RegisterMember)
            .RequireAuthorization(policy => policy.RequireRole(Roles.Admin, Roles.Vorstand, Roles.Member))
            .WithName("RegisterForEvent")
            .WithSummary("Als Mitglied für ein Event anmelden")
            .Produces<EventRegistrationDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status409Conflict);

        protectedGroup.MapPut("/{registrationId:guid}", UpdateRegistration)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("UpdateEventRegistration")
            .WithSummary("Eine Anmeldung aktualisieren")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/cancel", CancelRegistration)
            .RequireAuthorization(policy => policy.RequireRole(Roles.Admin, Roles.Vorstand, Roles.Member))
            .WithName("CancelEventRegistration")
            .WithSummary("Eine Anmeldung stornieren")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/confirm", ConfirmRegistration)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("ConfirmEventRegistration")
            .WithSummary("Eine ausstehende Anmeldung bestätigen")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/check-in", CheckInRegistration)
            .RequireAuthorization("RequireEventStaff")
            .WithName("CheckInEventRegistration")
            .WithSummary("Teilnehmer beim Event einchecken")
            .Produces<CheckInResultDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        // REQ-023 (E3.S2): Manual-search check-in entry point (separate audit verb)
        protectedGroup.MapPost("/{registrationId:guid}/manual-check-in", ManualCheckIn)
            .RequireAuthorization("RequireEventStaff")
            .WithName("ManualCheckInEventRegistration")
            .WithSummary("Manuelle Check-in über Teilnehmer-Suche")
            .Produces<CheckInResultDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        protectedGroup.MapPost("/{registrationId:guid}/no-show", MarkAsNoShow)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("MarkEventRegistrationNoShow")
            .WithSummary("Teilnehmer als No-Show markieren")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/revert-no-show", RevertNoShow)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("RevertEventRegistrationNoShow")
            .WithSummary("No-Show-Status zurücksetzen auf Bestätigt")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/revert-check-in", RevertCheckIn)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("RevertEventRegistrationCheckIn")
            .WithSummary("Check-In-Status zurücksetzen auf Bestätigt")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapPost("/{registrationId:guid}/revert-cancellation", RevertCancellation)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("RevertEventRegistrationCancellation")
            .WithSummary("Stornierung zurücksetzen auf Bestätigt")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapGet("/statistics", GetStatistics)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("GetEventRegistrationStatistics")
            .WithSummary("Statistiken für Event-Anmeldungen")
            .Produces<EventRegistrationStatistics>();

        protectedGroup.MapGet("/export-pdf", ExportRegistrationsPdf)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("ExportEventRegistrationsPdf")
            .WithSummary("Anmeldeliste als PDF exportieren")
            .Produces(200, contentType: "application/pdf")
            .Produces(StatusCodes.Status404NotFound);

        // REQ-023: Check-in roster + offline CSV export (E3.S1)
        protectedGroup.MapGet("/check-in-roster", GetCheckInRoster)
            .RequireAuthorization("RequireEventStaff")
            .WithName("GetEventCheckInRoster")
            .WithSummary("Check-In-Liste für ein Event abrufen")
            .Produces<EventCheckInRosterDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapGet("/check-in-roster/export.csv", ExportCheckInRoster)
            .RequireAuthorization("RequireEventStaff")
            .WithName("ExportEventCheckInRoster")
            .WithSummary("Check-In-Liste als CSV exportieren")
            .Produces(200, contentType: "text/csv")
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        protectedGroup.MapGet("/waitlist", GetWaitlist)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("GetEventWaitlist")
            .WithSummary("Warteliste für ein Event abrufen")
            .Produces<IReadOnlyList<EventRegistrationDto>>();

        protectedGroup.MapPost("/promote-from-waitlist", PromoteFromWaitlist)
            .RequireAuthorization(policy => policy.RequireRole(Roles.EventStaff))
            .WithName("PromoteFromWaitlist")
            .WithSummary("Nächste Person von der Warteliste nachrücken lassen")
            .Produces<EventRegistrationDto>()
            .Produces(StatusCodes.Status404NotFound);

        // REQ-021: My waitlist position endpoint
        protectedGroup.MapGet("/my-position", GetMyWaitlistPosition)
            .RequireAuthorization()
            .WithName("GetMyWaitlistPosition")
            .WithSummary("Eigene Wartelisten-Position abfragen")
            .Produces<WaitlistPositionDto>()
            .Produces(StatusCodes.Status404NotFound);

        // QR Code check-in endpoint.
        // REQ-087 (E10-S3 review patch): mapped on `endpoints` (not `protectedGroup`), so it
        // needs its own .RequireAuthorization("Module:events") — without it this endpoint
        // escaped the Events module gate that AC-4 requires for the registration surface.
        endpoints.MapPost("/api/v1/registrations/check-in/{qrCodeToken}", CheckInByQrCode)
            .RequireAuthorization("RequireEventStaff")
            .RequireAuthorization("Module:events")
            .WithTags("Event Registrations")
            .WithName("CheckInByQrCode")
            .WithSummary("Check-in per QR-Code")
            .Produces<CheckInResultDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        // My registrations endpoint.
        // REQ-087 (E10-S3 review patch): mapped on `endpoints` (not `protectedGroup`), so it
        // needs its own .RequireAuthorization("Module:events") to stay inside the Events gate.
        endpoints.MapGet("/api/v1/my-registrations", GetMyRegistrations)
            .RequireAuthorization()
            .RequireAuthorization("Module:events")
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
        IEventRegistrationRepository registrationRepository,
        IEventNotificationService notificationService,
        IEventFeeCategoryRepository feeCategoryRepository,
        IModuleSettingsService moduleSettings,
        IPaidRegistrationService paidRegistrationService)
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

        // REQ-022 (E4-S2): if a paid fee category applies, register + raise the invoice atomically.
        var paidResult = await TryHandlePaidRegistrationAsync(
            evt, registration, request.FeeCategoryId, isMember: false,
            feeCategoryRepository, moduleSettings, paidRegistrationService, notificationService);
        if (paidResult is not null)
            return paidResult;

        await registrationRepository.AddAsync(registration);

        // REQ-021: Send notification email (waitlist or confirmation)
        try
        {
            if (registration.IsWaitlisted)
                await notificationService.SendWaitlistConfirmationAsync(registration, evt);
            else
                await notificationService.SendRegistrationConfirmationAsync(registration, evt);
        }
        catch { /* Email failure should not break registration */ }

        return Results.Created(
            $"/api/v1/events/{eventId}/registrations/{registration.Id}",
            MapToDto(registration));
    }

    private static async Task<IResult> RegisterMember(
        Guid eventId,
        RegisterMemberRequest request,
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository,
        IEventNotificationService notificationService,
        IEventFeeCategoryRepository feeCategoryRepository,
        IModuleSettingsService moduleSettings,
        IPaidRegistrationService paidRegistrationService,
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
            // REQ-023 (E3.S2 Round-3 R3-H-S2-4): MemberId is mandatory for member-bound
            // registrations. Previous code defaulted to Guid.Empty, which the entity factory
            // now rejects — return a clean 400 instead of letting the ArgumentException bubble
            // up as a 500. (The waitlisted branch above accepts a nullable MemberId because
            // `CreateWaitlisted` legitimately supports both member and guest waitlist rows.)
            if (request.MemberId is null || request.MemberId.Value == Guid.Empty)
                return Results.BadRequest(new { message = "MemberId is required for member registration" });

            registration = EventRegistration.CreateForMember(
                eventId,
                userId,
                request.MemberId.Value,
                userName,
                userEmail,
                request.NumberOfGuests,
                request.Phone,
                request.SpecialRequirements);
        }

        // REQ-022 (E4-S2): if a paid fee category applies, register + raise the invoice atomically.
        var paidResult = await TryHandlePaidRegistrationAsync(
            evt, registration, request.FeeCategoryId, isMember: true,
            feeCategoryRepository, moduleSettings, paidRegistrationService, notificationService);
        if (paidResult is not null)
            return paidResult;

        await registrationRepository.AddAsync(registration);

        // REQ-021: Send notification email (waitlist or confirmation)
        try
        {
            if (registration.IsWaitlisted)
                await notificationService.SendWaitlistConfirmationAsync(registration, evt);
            else
                await notificationService.SendRegistrationConfirmationAsync(registration, evt);
        }
        catch { /* Email failure should not break registration */ }

        return Results.Created(
            $"/api/v1/events/{eventId}/registrations/{registration.Id}",
            MapToDto(registration));
    }

    private static async Task<IResult> GetRegistrations(
        Guid eventId,
        IEventRegistrationRepository registrationRepository,
        IInvoiceRepository invoiceRepository,
        IFinanceProfileRepository financeProfileRepository,
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

        // REQ-022 (E4-S3): enrich the roster with the linked-invoice payment status (E4-S2).
        var ids = items.Select(r => r.Id).ToList();
        var invoices = await invoiceRepository.GetByEventRegistrationIdsAsync(ids);
        string? currency = null;
        if (invoices.Count > 0)
            currency = (await financeProfileRepository.GetActiveProfileAsync())?.Currency.ToString();

        var dtos = items.Select(r =>
        {
            var dto = MapToDto(r);
            if (invoices.TryGetValue(r.Id, out var inv) && inv.Status != InvoiceStatus.Cancelled)
            {
                dto = dto with
                {
                    PaymentStatus = inv.Status == InvoiceStatus.Paid ? "Paid" : "Pending",
                    AmountDue = inv.Total,
                    Currency = currency,
                    InvoiceId = inv.Id,
                    InvoiceNumber = inv.InvoiceNumber,
                };
            }
            return dto;
        }).ToList();

        return Results.Ok(new PagedResult<EventRegistrationDto>
        {
            Items = dtos,
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
        IEventRegistrationCancellationService cancellationService,
        IEventNotificationService notificationService,
        ClaimsPrincipal user,
        CancellationToken ct)
    {
        // Authorization pre-read. UserId is immutable on a registration, so an un-locked read
        // is safe for the ownership check; the state-changing cancel + waitlist promotion runs
        // under a FOR UPDATE transaction inside the cancellation service.
        var registration = await registrationRepository.GetByIdAsync(registrationId, ct);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        var isOwner = registration.UserId.HasValue &&
                      Guid.TryParse(userIdClaim, out var userId) &&
                      registration.UserId.Value == userId;
        var isAdmin = Roles.EventStaff.Any(user.IsInRole);

        if (!isOwner && !isAdmin)
            return Results.Forbid();

        // REQ-021 (H-S2-5 / Epic-3-retro §9): cancel + waitlist promotion run inside a single
        // FOR UPDATE transaction (event row + registration row) so two concurrent cancellations
        // for the same event cannot both promote the same waitlisted registration.
        var result = await cancellationService.CancelAsync(
            eventId, registrationId, request?.Reason,
            cancelledByParticipant: isOwner && !isAdmin, ct);

        if (result.Outcome == CancelRegistrationOutcome.NotFound)
            return Results.NotFound(new { message = "Registration not found" });

        // Notifications are sent outside the transaction — an email failure must not break the
        // committed cancellation.
        if (result.PromotedFromWaitlist is not null && result.Event is not null)
        {
            try
            {
                await notificationService.SendWaitlistPromotionAsync(result.PromotedFromWaitlist, result.Event, ct);
            }
            catch { /* Email failure should not break cancellation */ }
        }

        try
        {
            if (result.Event is not null)
                await notificationService.SendCancellationNotificationAsync(result.Registration!, result.Event, ct);
        }
        catch { /* Email failure should not break cancellation */ }

        return Results.Ok(MapToDto(result.Registration!));
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

    // REQ-023 (E3.S2): ID-based check-in. Delegates to MediatR; the handler writes the audit row.
    private static async Task<IResult> CheckInRegistration(
        Guid eventId,
        Guid registrationId,
        ISender sender,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var checkedInBy))
            return Results.BadRequest(new { message = "User ID not found" });

        var result = await sender.Send(
            new CheckInRegistrationCommand(eventId, registrationId, QrCodeToken: null, checkedInBy, user),
            cancellationToken);

        return MapCheckInResult(result, "Registration not found");
    }

    // REQ-023 (E3.S2): Manual-search check-in. The search hash is computed here so the raw
    // search text never crosses into Application; the handler picks the audit verb.
    private static async Task<IResult> ManualCheckIn(
        Guid eventId,
        Guid registrationId,
        ManualCheckInRequest? request,
        ISender sender,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var checkedInBy))
            return Results.BadRequest(new { message = "User ID not found" });

        var searchQueryHash = CheckInSearchHasher.Hash(request?.SearchQuery);
        var result = await sender.Send(
            new ManualCheckInRegistrationCommand(
                eventId,
                registrationId,
                checkedInBy,
                user,
                SearchQueryHash: string.IsNullOrEmpty(searchQueryHash) ? null : searchQueryHash),
            cancellationToken);

        return MapCheckInResult(result, "Registration not found");
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

    private static async Task<IResult> RevertNoShow(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        registration.RevertNoShow();
        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> RevertCheckIn(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        registration.RevertCheckIn();
        await registrationRepository.UpdateAsync(registration);

        return Results.Ok(MapToDto(registration));
    }

    private static async Task<IResult> RevertCancellation(
        Guid eventId,
        Guid registrationId,
        IEventRegistrationRepository registrationRepository)
    {
        var registration = await registrationRepository.GetByIdAsync(registrationId);
        if (registration == null || registration.EventId != eventId)
            return Results.NotFound(new { message = "Registration not found" });

        registration.RevertCancellation();
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

    private static async Task<IResult> ExportRegistrationsPdf(
        Guid eventId,
        IEventRepository eventRepository,
        IEventRegistrationRepository registrationRepository,
        IRegistrationPdfExporter pdfExporter)
    {
        var evt = await eventRepository.GetByIdAsync(eventId);
        if (evt == null)
            return Results.NotFound(new { message = "Event not found" });

        var registrations = await registrationRepository.GetByEventIdAsync(eventId);
        var statistics = await registrationRepository.GetStatisticsAsync(eventId);
        var pdfBytes = await pdfExporter.GenerateRegistrationListPdfAsync(evt, registrations, statistics);

        var safeTitle = string.Join("_", evt.Title.Split(Path.GetInvalidFileNameChars()));
        var fileName = $"Anmeldeliste_{safeTitle}_{DateTime.UtcNow:yyyyMMdd}.pdf";

        return Results.File(pdfBytes, contentType: "application/pdf", fileDownloadName: fileName);
    }

    private static async Task<IResult> GetCheckInRoster(
        Guid eventId,
        ISender sender,
        bool? includeWaitlisted,
        CancellationToken cancellationToken)
    {
        var lookup = await sender.Send(
            new GetEventCheckInRosterQuery(eventId, includeWaitlisted ?? false),
            cancellationToken);

        // REQ-023 (E3.S1 review H-S1-3): distinguish archive-expired from not-found per spec
        // AC-7 — the message lets clients differentiate "URL is wrong / event was deleted"
        // from "the event existed but its retention window has passed".
        if (lookup.ArchiveExpired)
            return Results.NotFound(new { message = "Event archive lookup expired" });
        if (lookup.Roster is null)
            return Results.NotFound(new { message = "Event not found" });

        return Results.Ok(lookup.Roster);
    }

    private static async Task<IResult> ExportCheckInRoster(
        Guid eventId,
        ISender sender,
        bool? includeWaitlisted,
        CancellationToken cancellationToken)
    {
        var lookup = await sender.Send(
            new ExportEventCheckInRosterQuery(eventId, includeWaitlisted ?? false),
            cancellationToken);

        if (lookup.ArchiveExpired)
            return Results.NotFound(new { message = "Event archive lookup expired" });
        if (lookup.File is null)
            return Results.NotFound(new { message = "Event not found" });

        return Results.File(lookup.File.Content, contentType: "text/csv", fileDownloadName: lookup.File.FileName);
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
        IEventRegistrationRepository registrationRepository,
        IEventRepository eventRepository,
        IEventNotificationService notificationService)
    {
        var nextOnWaitlist = await registrationRepository.GetNextOnWaitlistAsync(eventId);
        if (nextOnWaitlist == null)
            return Results.NotFound(new { message = "No one on waitlist" });

        nextOnWaitlist.PromoteFromWaitlist();
        await registrationRepository.UpdateAsync(nextOnWaitlist);

        // REQ-021: Send promotion notification
        var evt = await eventRepository.GetByIdAsync(eventId);
        if (evt != null)
        {
            try
            {
                await notificationService.SendWaitlistPromotionAsync(nextOnWaitlist, evt);
            }
            catch { /* Email failure should not break promotion */ }
        }

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

    // REQ-023 (E3.S2): QR-token check-in. Delegates to MediatR; the handler picks the
    // EventCheckInScanned audit verb based on the non-null QrCodeToken discriminator.
    private static async Task<IResult> CheckInByQrCode(
        string qrCodeToken,
        ISender sender,
        ClaimsPrincipal user,
        CancellationToken cancellationToken)
    {
        if (!TryGetUserId(user, out var checkedInBy))
            return Results.BadRequest(new { message = "User ID not found" });

        var result = await sender.Send(
            new CheckInRegistrationCommand(EventId: Guid.Empty, RegistrationId: null, qrCodeToken, checkedInBy, user),
            cancellationToken);

        // Preserve the existing 404 wording for the QR path per D7.
        return MapCheckInResult(result, "Invalid QR code");
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out userId);
    }

    /// <summary>
    /// REQ-023 (E3.S2): single result-mapper for all three check-in entry points.
    ///
    /// <para>REQ-023 (E3.S2 Round-3 R3-DN-3): audit-log was moved into the MediatR handlers so
    /// this mapper now only translates the typed <see cref="CheckInResultDto"/> outcome to a
    /// minimal-API <see cref="IResult"/>. The handler is responsible for writing the
    /// <c>LogAccessGranted</c> audit row with the correct verb on state-changing outcomes.</para>
    /// </summary>
    private static IResult MapCheckInResult(CheckInResultDto result, string notFoundMessage)
    {
        // REQ-023 (E3.S2 review H-S2-1): redact the QR token from every check-in response. The
        // token is a credential that triggers a state-changing check-in via the QR endpoint;
        // leaking it back to clients (including the manual-check-in path and the conflict
        // response) lets a script that observes one check-in replay or revert it.
        var sanitized = RedactToken(result);

        switch (sanitized.Outcome)
        {
            case CheckInOutcome.CheckedIn:
            case CheckInOutcome.AlreadyCheckedIn:
                // Both 200; the idempotent path writes no audit row (handled in the handler).
                return Results.Ok(sanitized);

            case CheckInOutcome.NotFound:
                return Results.NotFound(new { message = notFoundMessage });

            case CheckInOutcome.Conflict:
                var reason = sanitized.Conflict?.ToString() ?? "Unknown";
                // R4-P-S2-1: explicit message per ConflictReason — Pending and NoShow are now
                // typed conflicts too (previously they escaped as an unhandled 500).
                var message = sanitized.Conflict switch
                {
                    ConflictReason.Cancelled => "Cannot check in a cancelled registration",
                    ConflictReason.Waitlisted => "Cannot check in a waitlisted registration",
                    ConflictReason.Pending => "Cannot check in a pending (un-confirmed) registration",
                    ConflictReason.NoShow => "Cannot check in a no-show registration; revert no-show first",
                    _ => "Cannot check in this registration",
                };
                return Results.Conflict(new { message, reason });

            default:
                throw new InvalidOperationException($"Unhandled check-in outcome '{sanitized.Outcome}'.");
        }
    }

    private static CheckInResultDto RedactToken(CheckInResultDto result)
    {
        if (result.Registration is null)
            return result;
        var redacted = result.Registration with { QrCodeToken = string.Empty };
        return result with { Registration = redacted };
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

    private static async Task<IResult> GetMyWaitlistPosition(
        Guid eventId,
        IEventRegistrationRepository registrationRepository,
        ClaimsPrincipal user)
    {
        var userIdClaim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                       ?? user.FindFirst("sub")?.Value;
        if (!Guid.TryParse(userIdClaim, out var userId))
            return Results.BadRequest(new { message = "User ID not found" });

        var registrations = await registrationRepository.GetByUserIdAsync(userId);
        var registration = registrations.FirstOrDefault(r => r.EventId == eventId && r.IsWaitlisted);

        if (registration == null)
            return Results.NotFound(new { message = "You are not on the waitlist for this event" });

        var totalWaitlisted = await registrationRepository.CountWaitlistedAsync(eventId);

        return Results.Ok(new WaitlistPositionDto
        {
            RegistrationId = registration.Id,
            EventId = eventId,
            Position = registration.WaitlistPosition ?? 0,
            TotalOnWaitlist = totalWaitlisted,
            RegisteredAt = registration.RegisteredAt
        });
    }

    private static EventRegistrationDto MapToDto(EventRegistration r) => EventRegistrationDto.FromEntity(r);

    /// <summary>
    /// REQ-022 (E4-S2): paid-registration branch. Returns a non-null <see cref="IResult"/> when the
    /// registration is handled here (paid path created, selection required, or finance disabled);
    /// returns <c>null</c> to fall through to the existing free registration path.
    /// </summary>
    private static async Task<IResult?> TryHandlePaidRegistrationAsync(
        Event evt,
        EventRegistration registration,
        Guid? requestedFeeCategoryId,
        bool isMember,
        IEventFeeCategoryRepository feeCategoryRepository,
        IModuleSettingsService moduleSettings,
        IPaidRegistrationService paidRegistrationService,
        IEventNotificationService notificationService)
    {
        // Waitlisted registrations are not charged yet — no invoice until they are promoted.
        if (registration.IsWaitlisted)
            return null;

        var now = DateTime.UtcNow;
        var categories = await feeCategoryRepository.GetByEventIdAsync(evt.Id, includeInactive: false);
        var applicable = categories
            .Where(c => c.IsAvailableAt(now) && c.AppliesTo(isMember))
            .ToList();

        if (applicable.Count == 0)
            return null; // free path

        EventFeeCategory? chosen;
        if (requestedFeeCategoryId is Guid fid && fid != Guid.Empty)
        {
            chosen = applicable.FirstOrDefault(c => c.Id == fid);
            if (chosen is null)
                return Results.BadRequest(new { message = "Selected fee category is not available for this registration." });
        }
        else if (applicable.Count == 1)
        {
            chosen = applicable[0];
        }
        else
        {
            return Results.BadRequest(new
            {
                message = "A fee category must be selected for this event.",
                errorCode = "FeeCategorySelectionRequired",
            });
        }

        // DEC-7 / ADR-008 L237: the paid branch requires the Finance module. The free path is
        // unaffected. (E10-S5 owns the toggle rules; here we block the paid action when off.)
        if (!await moduleSettings.IsEnabledAsync(ModuleKeys.Finance))
        {
            return Results.Json(
                new { message = "Paid registration requires the Finance module to be enabled." },
                statusCode: StatusCodes.Status403Forbidden);
        }

        try
        {
            await paidRegistrationService.CreatePaidRegistrationAsync(
                registration, chosen, evt.Title, evt.StartDate);
        }
        catch (InvalidOperationException ex)
        {
            // Locked fiscal period or currency mismatch — nothing was persisted (AC-3).
            return Results.BadRequest(new { message = ex.Message });
        }

        try
        {
            await notificationService.SendRegistrationConfirmationAsync(registration, evt);
        }
        catch { /* Email failure should not break the committed registration + invoice */ }

        return Results.Created(
            $"/api/v1/events/{evt.Id}/registrations/{registration.Id}",
            MapToDto(registration));
    }
}

// Request/Response DTOs
public record RegisterPublicRequest(
    string Name,
    string Email,
    string? Phone = null,
    int NumberOfGuests = 1,
    string? SpecialRequirements = null,
    // REQ-022 (E4-S2): the chosen fee category for a paid event (set by the E4-S3 UI). Optional;
    // auto-resolved when the event has exactly one applicable active fee category.
    Guid? FeeCategoryId = null);

public record RegisterMemberRequest(
    string? Name = null,
    string? Email = null,
    string? Phone = null,
    Guid? MemberId = null,
    int NumberOfGuests = 1,
    string? SpecialRequirements = null,
    Guid? FeeCategoryId = null);

public record UpdateRegistrationRequest(
    string ParticipantName,
    string ParticipantEmail,
    string? ParticipantPhone,
    int NumberOfGuests,
    string? SpecialRequirements,
    string? Notes);

public record CancelRegistrationRequest(string? Reason = null);

/// <summary>
/// REQ-023 (E3.S2): Body for the manual-search check-in endpoint. The optional
/// <see cref="SearchQuery"/> is hashed into <c>searchQueryHash</c> for the audit
/// trail; it is never persisted in raw form. See <see cref="CheckInSearchHasher"/>.
/// </summary>
public record ManualCheckInRequest(string? SearchQuery = null);

public record PagedResult<T>
{
    public IReadOnlyList<T> Items { get; init; } = Array.Empty<T>();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages { get; init; }
}

public record WaitlistPositionDto
{
    public Guid RegistrationId { get; init; }
    public Guid EventId { get; init; }
    public int Position { get; init; }
    public int TotalOnWaitlist { get; init; }
    public DateTime RegisteredAt { get; init; }
}
