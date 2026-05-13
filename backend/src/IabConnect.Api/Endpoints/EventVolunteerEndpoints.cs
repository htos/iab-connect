using System.Security.Claims;
using IabConnect.Application.Authorization;
using IabConnect.Application.Events.Volunteers;
using IabConnect.Application.Events.Volunteers.Commands;
using IabConnect.Application.Events.Volunteers.Queries;
using MediatR;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-024 (E3.S3): API surface for the volunteer-planning aggregate. Endpoints split into two
/// route groups under <c>/api/v1/events/{eventId}/volunteer-roles</c> and
/// <c>/api/v1/events/{eventId}/volunteer-shifts</c>. <c>RequireEventStaff</c> gates CRUD;
/// <c>RequireMember</c> gates reads + self-signup.
/// <para>Post-Epic-3 review patches applied here: C1 (caller-ownership check on cancel),
/// M-S3-5 (Location header now uses <c>eventId</c> as the first URL segment), and outcome
/// mapping for the new <see cref="VolunteerAssignmentOutcome.ShiftCancelled"/>,
/// <see cref="VolunteerAssignmentOutcome.MemberNotFound"/>, and
/// <see cref="VolunteerAssignmentOutcome.NotAuthorized"/> values.</para>
/// </summary>
public static class EventVolunteerEndpoints
{
    /// <summary>
    /// Keycloak realm roles that satisfy <c>RequireEventStaff</c>. Mirrored from
    /// <c>backend/src/IabConnect.Api/DependencyInjection.cs</c> so the staff vs member
    /// determination for C1 reads from the same source of truth.
    /// </summary>
    private static readonly string[] StaffRoles = ["admin", "vorstand", "event-manager"];

    public static IEndpointRouteBuilder MapEventVolunteerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        // ---- Roles ----
        var roleGroup = endpoints.MapGroup("/api/v1/events/{eventId:guid}/volunteer-roles")
            .WithTags("Event Volunteer Roles")
            .RequireAuthorization();

        roleGroup.MapGet("/", GetRoles)
            .RequireAuthorization("RequireMember")
            .WithName("GetEventVolunteerRoles")
            .Produces<IReadOnlyList<EventVolunteerRoleDto>>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);

        roleGroup.MapPost("/", CreateRole)
            .RequireAuthorization("RequireEventStaff")
            .WithName("CreateEventVolunteerRole")
            .Produces<EventVolunteerRoleDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status409Conflict);

        roleGroup.MapPut("/{roleId:guid}", UpdateRole)
            .RequireAuthorization("RequireEventStaff")
            .WithName("UpdateEventVolunteerRole")
            .Produces<EventVolunteerRoleDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        // ---- Shifts ----
        var shiftGroup = endpoints.MapGroup("/api/v1/events/{eventId:guid}/volunteer-shifts")
            .WithTags("Event Volunteer Shifts")
            .RequireAuthorization();

        shiftGroup.MapGet("/", GetShifts)
            .RequireAuthorization("RequireMember")
            .WithName("GetEventVolunteerShifts")
            .Produces<IReadOnlyList<EventVolunteerShiftDto>>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);

        shiftGroup.MapPost("/", CreateShift)
            .RequireAuthorization("RequireEventStaff")
            .WithName("CreateEventVolunteerShift")
            .Produces<EventVolunteerShiftDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);

        shiftGroup.MapPut("/{shiftId:guid}", UpdateShift)
            .RequireAuthorization("RequireEventStaff")
            .WithName("UpdateEventVolunteerShift")
            .Produces<EventVolunteerShiftDto>()
            .Produces(StatusCodes.Status400BadRequest)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        shiftGroup.MapPost("/{shiftId:guid}/cancel", CancelShift)
            .RequireAuthorization("RequireEventStaff")
            .WithName("CancelEventVolunteerShift")
            .Produces<CancelEventVolunteerShiftResult>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        shiftGroup.MapGet("/{shiftId:guid}/assignments", GetAssignments)
            .RequireAuthorization("RequireMember")
            .WithName("GetVolunteerShiftAssignments")
            .Produces<IReadOnlyList<EventVolunteerAssignmentDto>>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden);

        shiftGroup.MapPost("/{shiftId:guid}/assignments", AssignVolunteer)
            .RequireAuthorization("RequireEventStaff")
            .WithName("AssignVolunteer")
            .Produces<EventVolunteerAssignmentDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        shiftGroup.MapPost("/{shiftId:guid}/self-signup", SelfSignUp)
            .RequireAuthorization("RequireMember")
            .WithName("SelfSignUpForVolunteerShift")
            .Produces<EventVolunteerAssignmentDto>(StatusCodes.Status201Created)
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound)
            .Produces(StatusCodes.Status409Conflict);

        shiftGroup.MapPost("/{shiftId:guid}/assignments/{assignmentId:guid}/cancel", CancelAssignment)
            .RequireAuthorization("RequireMember")
            .WithName("CancelVolunteerAssignment")
            .Produces<EventVolunteerAssignmentDto>()
            .Produces(StatusCodes.Status401Unauthorized)
            .Produces(StatusCodes.Status403Forbidden)
            .Produces(StatusCodes.Status404NotFound);

        return endpoints;
    }

    // ---------- Handlers ----------

    private static async Task<IResult> GetRoles(Guid eventId, ISender sender, CancellationToken ct)
    {
        var result = await sender.Send(new GetEventVolunteerRolesQuery(eventId), ct);
        return Results.Ok(result);
    }

    private static async Task<IResult> CreateRole(
        Guid eventId,
        CreateRoleRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        if (!TryGetUserId(user, out var userId))
            return Results.BadRequest(new { message = "User id not found." });

        try
        {
            var role = await sender.Send(
                new CreateEventVolunteerRoleCommand(eventId, request.Name, request.Description, userId), ct);
            auditLogger.LogAccessGranted(user, "EventVolunteerRole", "Create", role.Id.ToString());
            return Results.Created($"/api/v1/events/{eventId}/volunteer-roles/{role.Id}", role);
        }
        catch (InvalidOperationException ex)
        {
            return Results.Conflict(new { message = ex.Message, errorCode = "RoleNameAlreadyExists" });
        }
    }

    private static async Task<IResult> UpdateRole(
        Guid eventId,
        Guid roleId,
        UpdateRoleRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        try
        {
            var role = await sender.Send(
                new UpdateEventVolunteerRoleCommand(roleId, request.Name, request.Description, request.IsActive), ct);
            auditLogger.LogAccessGranted(user, "EventVolunteerRole", "Update", role.Id.ToString());
            return Results.Ok(role);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            // M-S3-7: rename-collision now surfaces as 409 instead of 500.
            return Results.Conflict(new { message = ex.Message, errorCode = "RoleNameAlreadyExists" });
        }
    }

    private static async Task<IResult> GetShifts(Guid eventId, ISender sender, CancellationToken ct)
    {
        var shifts = await sender.Send(new GetEventVolunteerShiftsQuery(eventId), ct);
        return Results.Ok(shifts);
    }

    private static async Task<IResult> CreateShift(
        Guid eventId,
        CreateShiftRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        if (!TryGetUserId(user, out var userId))
            return Results.BadRequest(new { message = "User id not found." });

        try
        {
            var shift = await sender.Send(
                new CreateEventVolunteerShiftCommand(
                    eventId, request.RoleId, request.Title, request.Description,
                    request.StartsAt, request.EndsAt, request.Capacity,
                    request.AllowWaitlist, request.AllowSelfSignup, request.Notes, userId), ct);
            auditLogger.LogAccessGranted(user, "EventVolunteerShift", "Create", shift.Id.ToString());
            return Results.Created($"/api/v1/events/{eventId}/volunteer-shifts/{shift.Id}", shift);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { message = ex.Message });
        }
    }

    private static async Task<IResult> UpdateShift(
        Guid eventId,
        Guid shiftId,
        UpdateShiftRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        try
        {
            var shift = await sender.Send(
                new UpdateEventVolunteerShiftCommand(
                    eventId, shiftId, request.Title, request.Description,
                    request.StartsAt, request.EndsAt, request.Capacity,
                    request.AllowWaitlist, request.AllowSelfSignup, request.Notes), ct);
            auditLogger.LogAccessGranted(user, "EventVolunteerShift", "Update", shift.Id.ToString());
            return Results.Ok(shift);
        }
        catch (KeyNotFoundException ex)
        {
            return Results.NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return Results.BadRequest(new { message = ex.Message });
        }
    }

    private static async Task<IResult> CancelShift(
        Guid eventId,
        Guid shiftId,
        CancelShiftRequest? request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        var result = await sender.Send(new CancelEventVolunteerShiftCommand(eventId, shiftId, request?.Reason), ct);
        if (!result.ShiftFound)
            return Results.NotFound(new { message = "Shift not found." });
        auditLogger.LogAccessGranted(user, "EventVolunteerShift", "Cancel", shiftId.ToString(),
            new Dictionary<string, object> { ["cancelledAssignmentCount"] = result.CancelledAssignmentCount });
        return Results.Ok(result);
    }

    private static async Task<IResult> GetAssignments(
        Guid eventId, Guid shiftId, ISender sender, CancellationToken ct)
    {
        var assignments = await sender.Send(new GetVolunteerShiftAssignmentsQuery(shiftId), ct);
        return Results.Ok(assignments);
    }

    private static async Task<IResult> AssignVolunteer(
        Guid eventId,
        Guid shiftId,
        AssignVolunteerRequest request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        if (!TryGetUserId(user, out var assignedBy))
            return Results.BadRequest(new { message = "User id not found." });

        var result = await sender.Send(
            new AssignVolunteerCommand(eventId, shiftId, request.MemberId, request.AllowWaitlistFallback, assignedBy), ct);

        return MapAssignmentResult(result, eventId, user, auditLogger, "Assign");
    }

    private static async Task<IResult> SelfSignUp(
        Guid eventId,
        Guid shiftId,
        SelfSignUpRequest? request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        if (!TryGetUserId(user, out var keycloakUserId))
            return Results.BadRequest(new { message = "User id not found." });

        try
        {
            var result = await sender.Send(
                new SelfSignUpForVolunteerShiftCommand(
                    eventId, shiftId, keycloakUserId, request?.AllowWaitlistFallback ?? false), ct);
            return MapAssignmentResult(result, eventId, user, auditLogger, "SelfSignup");
        }
        catch (InvalidOperationException ex)
        {
            // User has no linked Member record — surface as 403.
            return Results.Json(new { message = ex.Message, errorCode = "NoMemberLink" }, statusCode: StatusCodes.Status403Forbidden);
        }
    }

    private static async Task<IResult> CancelAssignment(
        Guid eventId,
        Guid shiftId,
        Guid assignmentId,
        CancelAssignmentRequest? request,
        ISender sender,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        // C1: caller's Keycloak id + staff-role flag flow into the command. The handler
        // resolves the caller's Member and the service rejects when the caller is neither
        // owner nor staff.
        if (!TryGetUserId(user, out var callerKeycloakUserId))
            return Results.BadRequest(new { message = "User id not found." });
        var callerIsStaff = IsStaffCaller(user);

        var result = await sender.Send(
            new CancelVolunteerAssignmentCommand(eventId, assignmentId, request?.Reason, callerKeycloakUserId, callerIsStaff), ct);

        if (result.Outcome == VolunteerAssignmentOutcome.AssignmentNotFound)
            return Results.NotFound(new { message = "Assignment not found." });
        if (result.Outcome == VolunteerAssignmentOutcome.NotAuthorized)
        {
            auditLogger.LogAccessDenied(user, "EventVolunteerAssignment", "Cancel",
                "Caller is not the assignment owner and lacks an event-staff role.", assignmentId.ToString());
            return Results.Json(
                new { message = "Caller may only cancel their own assignment.", errorCode = "NotAuthorized" },
                statusCode: StatusCodes.Status403Forbidden);
        }

        auditLogger.LogAccessGranted(user, "EventVolunteerAssignment", "Cancel", assignmentId.ToString());
        return Results.Ok(result.Assignment);
    }

    // ---------- Result mapper ----------

    /// <summary>
    /// Maps a <see cref="VolunteerAssignmentCommandResult"/> from the service layer to the
    /// canonical HTTP shape (with the AC-8 / D11 <c>{ message, errorCode }</c> body on 409 / 403
    /// outcomes). Post-review M-S3-5: the Location header now uses <paramref name="eventId"/>
    /// as the first URL segment (previously misused <c>RoleId</c>, producing 404 links).
    /// </summary>
    private static IResult MapAssignmentResult(
        VolunteerAssignmentCommandResult result,
        Guid eventId,
        ClaimsPrincipal user,
        ISecurityAuditLogger auditLogger,
        string auditAction)
    {
        switch (result.Outcome)
        {
            case VolunteerAssignmentOutcome.Confirmed:
            case VolunteerAssignmentOutcome.Waitlisted:
                auditLogger.LogAccessGranted(
                    user, "EventVolunteerAssignment", auditAction,
                    result.Assignment!.Id.ToString(),
                    new Dictionary<string, object>
                    {
                        ["outcome"] = result.Outcome.ToString(),
                        ["shiftId"] = result.Assignment.ShiftId,
                    });
                return Results.Created(
                    $"/api/v1/events/{eventId}/volunteer-shifts/{result.Assignment.ShiftId}/assignments/{result.Assignment.Id}",
                    result.Assignment);

            case VolunteerAssignmentOutcome.AlreadyAssigned:
                return Results.Conflict(new
                {
                    message = "Member already has an active assignment for this shift.",
                    errorCode = "AlreadyAssigned",
                    assignment = result.Assignment,
                });

            case VolunteerAssignmentOutcome.ShiftFull:
                return Results.Conflict(new
                {
                    message = "Shift is at capacity and waitlist is disabled.",
                    errorCode = "ShiftFull",
                });

            case VolunteerAssignmentOutcome.SignupNotAllowed:
                return Results.Conflict(new
                {
                    message = "Self-signup is disabled for this shift.",
                    errorCode = "SignupNotAllowed",
                });

            case VolunteerAssignmentOutcome.ShiftCancelled:
                // H-S3-6: new outcome — shift was cancelled by an event manager.
                return Results.Conflict(new
                {
                    message = "Shift has been cancelled.",
                    errorCode = "ShiftCancelled",
                });

            case VolunteerAssignmentOutcome.ShiftNotFound:
                return Results.NotFound(new { message = "Shift not found." });

            case VolunteerAssignmentOutcome.MemberNotFound:
                // M-S3-2: foreign-key violation on insert surfaces as 404 with a clear message.
                return Results.NotFound(new { message = "Member not found." });

            default:
                throw new InvalidOperationException($"Unhandled assignment outcome '{result.Outcome}'.");
        }
    }

    private static bool TryGetUserId(ClaimsPrincipal user, out Guid userId)
    {
        var claim = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
                 ?? user.FindFirst("sub")?.Value;
        return Guid.TryParse(claim, out userId);
    }

    /// <summary>
    /// C1: True when the caller holds any of the realm roles that satisfy <c>RequireEventStaff</c>.
    /// Matches the policy definition in
    /// <c>backend/src/IabConnect.Api/DependencyInjection.cs</c>.
    /// </summary>
    private static bool IsStaffCaller(ClaimsPrincipal user)
    {
        foreach (var role in StaffRoles)
        {
            if (user.IsInRole(role)) return true;
        }
        return false;
    }
}

// ---------- Request DTOs ----------

public record CreateRoleRequest(string Name, string? Description);
public record UpdateRoleRequest(string Name, string? Description, bool IsActive);
public record CreateShiftRequest(
    Guid RoleId,
    string Title,
    string? Description,
    DateTime StartsAt,
    DateTime EndsAt,
    int Capacity,
    bool AllowWaitlist,
    bool AllowSelfSignup,
    string? Notes);
public record UpdateShiftRequest(
    string Title,
    string? Description,
    DateTime StartsAt,
    DateTime EndsAt,
    int Capacity,
    bool AllowWaitlist,
    bool AllowSelfSignup,
    string? Notes);
public record CancelShiftRequest(string? Reason = null);
public record AssignVolunteerRequest(Guid MemberId, bool AllowWaitlistFallback = false);
public record SelfSignUpRequest(bool AllowWaitlistFallback = false);
public record CancelAssignmentRequest(string? Reason = null);
