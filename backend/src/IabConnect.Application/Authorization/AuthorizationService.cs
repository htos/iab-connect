using System.Security.Claims;
using IabConnect.Domain.Authorization;
using IabConnect.Domain.Members;

namespace IabConnect.Application.Authorization;

/// <summary>
/// REQ-004: Feingranulare Zugriffskontrolle
/// Authorization service for checking permissions and resource ownership.
/// </summary>
public interface IAuthorizationService
{
    /// <summary>
    /// Gets the Keycloak user ID from the current user's claims.
    /// </summary>
    Guid? GetCurrentUserId(ClaimsPrincipal user);

    /// <summary>
    /// Gets all roles for the current user.
    /// </summary>
    IEnumerable<string> GetUserRoles(ClaimsPrincipal user);

    /// <summary>
    /// Checks if the current user has a specific permission.
    /// </summary>
    bool HasPermission(ClaimsPrincipal user, string permission);

    /// <summary>
    /// Checks if the current user can access a specific member resource.
    /// </summary>
    Task<AuthorizationResult> CanAccessMemberAsync(
        ClaimsPrincipal user,
        Guid memberId,
        string requiredPermission,
        IMemberRepository memberRepository,
        CancellationToken ct = default);

    /// <summary>
    /// Checks if the current user owns a member resource.
    /// </summary>
    Task<bool> IsOwnerOfMemberAsync(
        ClaimsPrincipal user,
        Guid memberId,
        IMemberRepository memberRepository,
        CancellationToken ct = default);

    /// <summary>
    /// Checks if the current user can perform an action on their own resource.
    /// </summary>
    bool CanAccessOwnResource(ClaimsPrincipal user, Guid keycloakUserId);
}

/// <summary>
/// Result of an authorization check.
/// </summary>
public sealed class AuthorizationResult
{
    public bool IsAuthorized { get; private init; }
    public string? DenialReason { get; private init; }
    public string? RequiredPermission { get; private init; }
    public string? ActualPermissions { get; private init; }

    public static AuthorizationResult Success() => new() { IsAuthorized = true };

    public static AuthorizationResult Denied(string reason, string? requiredPermission = null, IEnumerable<string>? actualPermissions = null)
        => new()
        {
            IsAuthorized = false,
            DenialReason = reason,
            RequiredPermission = requiredPermission,
            ActualPermissions = actualPermissions != null ? string.Join(", ", actualPermissions) : null
        };
}

/// <summary>
/// Default implementation of the authorization service.
/// </summary>
public sealed class AuthorizationService : IAuthorizationService
{
    public Guid? GetCurrentUserId(ClaimsPrincipal user)
    {
        // Try different claim types for the user ID
        var subClaim = user.FindFirst("sub")
                      ?? user.FindFirst(ClaimTypes.NameIdentifier);

        if (subClaim != null && Guid.TryParse(subClaim.Value, out var userId))
        {
            return userId;
        }

        return null;
    }

    public IEnumerable<string> GetUserRoles(ClaimsPrincipal user)
    {
        return user.FindAll(ClaimTypes.Role)
            .Select(c => c.Value)
            .Distinct();
    }

    public bool HasPermission(ClaimsPrincipal user, string permission)
    {
        var roles = GetUserRoles(user);
        return RolePermissions.HasPermission(roles, permission);
    }

    public async Task<AuthorizationResult> CanAccessMemberAsync(
        ClaimsPrincipal user,
        Guid memberId,
        string requiredPermission,
        IMemberRepository memberRepository,
        CancellationToken ct = default)
    {
        var roles = GetUserRoles(user).ToList();
        var userPermissions = RolePermissions.GetPermissionsForRoles(roles);

        // Check if user has full permission (not just "own")
        if (userPermissions.Contains(requiredPermission))
        {
            return AuthorizationResult.Success();
        }

        // Check if user has "own" permission and is the owner
        var ownPermission = requiredPermission + ":own";
        if (userPermissions.Contains(ownPermission))
        {
            var isOwner = await IsOwnerOfMemberAsync(user, memberId, memberRepository, ct);
            if (isOwner)
            {
                return AuthorizationResult.Success();
            }

            return AuthorizationResult.Denied(
                "User can only access their own member profile",
                requiredPermission,
                userPermissions);
        }

        return AuthorizationResult.Denied(
            $"Missing required permission: {requiredPermission}",
            requiredPermission,
            userPermissions);
    }

    public async Task<bool> IsOwnerOfMemberAsync(
        ClaimsPrincipal user,
        Guid memberId,
        IMemberRepository memberRepository,
        CancellationToken ct = default)
    {
        var currentUserId = GetCurrentUserId(user);
        if (currentUserId == null)
            return false;

        var member = await memberRepository.GetByIdAsync(memberId, ct);
        if (member == null)
            return false;

        return member.KeycloakUserId == currentUserId;
    }

    public bool CanAccessOwnResource(ClaimsPrincipal user, Guid keycloakUserId)
    {
        var currentUserId = GetCurrentUserId(user);
        return currentUserId != null && currentUserId == keycloakUserId;
    }
}
