using System.Security.Claims;
using IabConnect.Application.Authorization;
using IabConnect.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-001: Identity and authentication endpoints
/// </summary>
public static class IdentityEndpoints
{
    public static RouteGroupBuilder MapIdentityEndpoints(this RouteGroupBuilder group)
    {
        var identity = group.MapGroup("/identity")
            .WithTags("Identity");

        // REQ-001: Get current user profile from JWT token
        identity.MapGet("/me", GetCurrentUser)
            .RequireAuthorization()
            .WithName("GetCurrentUser")
            .WithDescription("REQ-001: Gibt das Profil des aktuell angemeldeten Benutzers zurück")
            .Produces<UserProfileResponse>(200)
            .Produces(401);

        // REQ-001: Get current user's roles
        identity.MapGet("/roles", GetCurrentUserRoles)
            .RequireAuthorization()
            .WithName("GetCurrentUserRoles")
            .WithDescription("REQ-001: Gibt die Rollen des aktuell angemeldeten Benutzers zurück")
            .Produces<UserRolesResponse>(200)
            .Produces(401);

        // REQ-001: Check if user has specific role
        identity.MapGet("/check-role/{role}", CheckUserRole)
            .RequireAuthorization()
            .WithName("CheckUserRole")
            .WithDescription("REQ-001: Prüft ob der Benutzer eine bestimmte Rolle hat")
            .Produces<RoleCheckResponse>(200)
            .Produces(401);

        // REQ-001: Admin-only endpoint to verify admin access
        identity.MapGet("/admin-check", CheckAdminAccess)
            .RequireAuthorization("RequireAdmin")
            .WithName("CheckAdminAccess")
            .WithDescription("REQ-001: Prüft Admin-Zugriff")
            .Produces<AccessCheckResponse>(200)
            .Produces(401)
            .Produces(403);

        // REQ-001: Vorstand-only endpoint to verify vorstand access
        identity.MapGet("/vorstand-check", CheckVorstandAccess)
            .RequireAuthorization("RequireVorstand")
            .WithName("CheckVorstandAccess")
            .WithDescription("REQ-001: Prüft Vorstand-Zugriff")
            .Produces<AccessCheckResponse>(200)
            .Produces(401)
            .Produces(403);

        // REQ-001: Member-only endpoint to verify member access
        identity.MapGet("/member-check", CheckMemberAccess)
            .RequireAuthorization("RequireMember")
            .WithName("CheckMemberAccess")
            .WithDescription("REQ-001: Prüft Mitglied-Zugriff")
            .Produces<AccessCheckResponse>(200)
            .Produces(401)
            .Produces(403);

        // REQ-010: Get current user's active Keycloak sessions
        identity.MapGet("/sessions", GetCurrentUserSessions)
            .RequireAuthorization()
            .WithName("GetCurrentUserSessions")
            .WithDescription("REQ-010: Gibt die aktiven Keycloak-Sessions des aktuell angemeldeten Benutzers zurück")
            .Produces<SessionListResponse>(200)
            .Produces(401);

        // REQ-010: Revoke one of the current user's own Keycloak sessions
        identity.MapDelete("/sessions/{sessionId}", RevokeCurrentUserSession)
            .RequireAuthorization()
            .WithName("RevokeCurrentUserSession")
            .WithDescription("REQ-010: Beendet eine eigene Keycloak-Session des aktuell angemeldeten Benutzers")
            .Produces(204)
            .Produces(401)
            .Produces(404);

        return group;
    }

    private static IResult GetCurrentUser(ClaimsPrincipal user)
    {
        var userId = user.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? user.FindFirst("sub")?.Value;
        var email = user.FindFirst(ClaimTypes.Email)?.Value
            ?? user.FindFirst("email")?.Value;
        var name = user.FindFirst(ClaimTypes.Name)?.Value
            ?? user.FindFirst("name")?.Value
            ?? user.FindFirst("preferred_username")?.Value;
        var givenName = user.FindFirst(ClaimTypes.GivenName)?.Value
            ?? user.FindFirst("given_name")?.Value;
        var familyName = user.FindFirst(ClaimTypes.Surname)?.Value
            ?? user.FindFirst("family_name")?.Value;

        // Extract roles from Keycloak claims
        var roles = ExtractRoles(user);

        return Results.Ok(new UserProfileResponse
        {
            UserId = userId ?? "",
            Email = email ?? "",
            Name = name ?? "",
            GivenName = givenName ?? "",
            FamilyName = familyName ?? "",
            Roles = roles
        });
    }

    private static IResult GetCurrentUserRoles(ClaimsPrincipal user)
    {
        var roles = ExtractRoles(user);
        return Results.Ok(new UserRolesResponse
        {
            Roles = roles,
            IsAdmin = roles.Contains("admin"),
            IsVorstand = roles.Contains("vorstand") || roles.Contains("admin"),
            IsMember = roles.Contains("member") || roles.Contains("vorstand") || roles.Contains("admin")
        });
    }

    private static IResult CheckUserRole(string role, ClaimsPrincipal user)
    {
        var roles = ExtractRoles(user);
        var hasRole = roles.Contains(role.ToLower());

        return Results.Ok(new RoleCheckResponse
        {
            Role = role,
            HasRole = hasRole
        });
    }

    private static IResult CheckAdminAccess()
    {
        return Results.Ok(new AccessCheckResponse
        {
            HasAccess = true,
            AccessLevel = "admin",
            Message = "Admin-Zugriff bestätigt"
        });
    }

    private static IResult CheckVorstandAccess()
    {
        return Results.Ok(new AccessCheckResponse
        {
            HasAccess = true,
            AccessLevel = "vorstand",
            Message = "Vorstand-Zugriff bestätigt"
        });
    }

    private static IResult CheckMemberAccess()
    {
        return Results.Ok(new AccessCheckResponse
        {
            HasAccess = true,
            AccessLevel = "member",
            Message = "Mitglied-Zugriff bestätigt"
        });
    }

    private static async Task<Results<Ok<SessionListResponse>, UnauthorizedHttpResult, ProblemHttpResult>> GetCurrentUserSessions(
        ClaimsPrincipal user,
        IKeycloakAdminService keycloakAdmin,
        ILogger<KeycloakAdminService> logger,
        CancellationToken ct)
    {
        var userId = user.FindFirst("sub")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        try
        {
            var sessions = await keycloakAdmin.GetUserSessionsAsync(userId, ct);
            var response = new SessionListResponse
            {
                Sessions = sessions.Select(SessionMapper.ToDto).ToList()
            };
            return TypedResults.Ok(response);
        }
        catch (KeycloakNotFoundException)
        {
            // User exists in token but not in Keycloak Admin view — return empty list rather than 500.
            return TypedResults.Ok(new SessionListResponse { Sessions = new List<SessionDto>() });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to fetch sessions for current user {UserId}", userId);
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to fetch sessions");
        }
    }

    private static async Task<Results<NoContent, UnauthorizedHttpResult, NotFound, ProblemHttpResult>> RevokeCurrentUserSession(
        string sessionId,
        ClaimsPrincipal user,
        HttpContext httpContext,
        IKeycloakAdminService keycloakAdmin,
        ISecurityAuditLogger auditLogger,
        ILogger<KeycloakAdminService> logger,
        CancellationToken ct)
    {
        var userId = user.FindFirst("sub")?.Value
            ?? user.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        if (string.IsNullOrEmpty(userId))
        {
            return TypedResults.Unauthorized();
        }

        try
        {
            // Ownership gate: only allow revoking a session that belongs to the calling user.
            // Without this check, an authenticated user could revoke any session by guessing the sessionId.
            var ownedSessions = await keycloakAdmin.GetUserSessionsAsync(userId, ct);
            var matched = ownedSessions.FirstOrDefault(s => s.Id == sessionId);

            if (matched is null)
            {
                auditLogger.LogAccessDenied(
                    user,
                    "Session",
                    "RevokeOwn",
                    "Session does not belong to caller or does not exist",
                    sessionId);
                return TypedResults.NotFound();
            }

            await keycloakAdmin.RevokeSessionAsync(sessionId, ct);

            auditLogger.LogAccessGranted(
                user,
                "Session",
                "RevokeOwn",
                sessionId);

            return TypedResults.NoContent();
        }
        catch (KeycloakNotFoundException)
        {
            // Session disappeared between the ownership check and the delete — treat as success.
            return TypedResults.NoContent();
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to revoke own session {SessionId} for user {UserId}", sessionId, userId);
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to revoke session");
        }
    }

    private static List<string> ExtractRoles(ClaimsPrincipal user)
    {
        var roles = new List<string>();

        // Standard role claims
        roles.AddRange(user.FindAll(ClaimTypes.Role).Select(c => c.Value));

        // Keycloak realm_access roles
        var realmAccess = user.FindFirst("realm_access")?.Value;
        if (!string.IsNullOrEmpty(realmAccess))
        {
            try
            {
                var doc = System.Text.Json.JsonDocument.Parse(realmAccess);
                if (doc.RootElement.TryGetProperty("roles", out var rolesElement))
                {
                    foreach (var role in rolesElement.EnumerateArray())
                    {
                        var roleValue = role.GetString();
                        if (!string.IsNullOrEmpty(roleValue))
                        {
                            roles.Add(roleValue);
                        }
                    }
                }
            }
            catch
            {
                // Ignore JSON parsing errors
            }
        }

        // Keycloak resource_access roles (client-specific)
        var resourceAccess = user.FindFirst("resource_access")?.Value;
        if (!string.IsNullOrEmpty(resourceAccess))
        {
            try
            {
                var doc = System.Text.Json.JsonDocument.Parse(resourceAccess);
                foreach (var client in doc.RootElement.EnumerateObject())
                {
                    if (client.Value.TryGetProperty("roles", out var rolesElement))
                    {
                        foreach (var role in rolesElement.EnumerateArray())
                        {
                            var roleValue = role.GetString();
                            if (!string.IsNullOrEmpty(roleValue))
                            {
                                roles.Add(roleValue);
                            }
                        }
                    }
                }
            }
            catch
            {
                // Ignore JSON parsing errors
            }
        }

        return roles.Distinct().ToList();
    }
}

// Response DTOs
public record UserProfileResponse
{
    public required string UserId { get; init; }
    public required string Email { get; init; }
    public required string Name { get; init; }
    public required string GivenName { get; init; }
    public required string FamilyName { get; init; }
    public required List<string> Roles { get; init; }
}

public record UserRolesResponse
{
    public required List<string> Roles { get; init; }
    public required bool IsAdmin { get; init; }
    public required bool IsVorstand { get; init; }
    public required bool IsMember { get; init; }
}

public record RoleCheckResponse
{
    public required string Role { get; init; }
    public required bool HasRole { get; init; }
}

public record AccessCheckResponse
{
    public required bool HasAccess { get; init; }
    public required string AccessLevel { get; init; }
    public required string Message { get; init; }
}

// REQ-010: Session visibility DTOs
public record SessionDto
{
    public required string Id { get; init; }
    public string? IpAddress { get; init; }
    public DateTime? Start { get; init; }
    public DateTime? LastAccess { get; init; }
    public List<string> Clients { get; init; } = new();
}

public record SessionListResponse
{
    public required List<SessionDto> Sessions { get; init; }
}

internal static class SessionMapper
{
    public static SessionDto ToDto(KeycloakSessionRepresentation session) => new()
    {
        Id = session.Id ?? "",
        IpAddress = session.IpAddress,
        Start = session.Start.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(session.Start.Value).UtcDateTime
            : null,
        LastAccess = session.LastAccess.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(session.LastAccess.Value).UtcDateTime
            : null,
        Clients = session.Clients?.Values.Where(v => !string.IsNullOrWhiteSpace(v)).ToList() ?? new List<string>()
    };
}
