using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Identity;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Http.HttpResults;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// User management endpoints for administrators
/// REQ-002: Benutzerverwaltung
/// </summary>
public static class UserEndpoints
{
    public static void MapUserEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/users")
            .WithTags("Users")
            .RequireAuthorization("RequireAdmin");

        group.MapGet("/", GetUsers)
            .WithName("GetUsers")
            .WithSummary("Get list of all users");

        group.MapGet("/count", GetUserCount)
            .WithName("GetUserCount")
            .WithSummary("Get total user count");

        group.MapGet("/{userId}", GetUser)
            .WithName("GetUser")
            .WithSummary("Get user by ID");

        group.MapPost("/", CreateUser)
            .WithName("CreateUser")
            .WithSummary("Create new user");

        group.MapPut("/{userId}", UpdateUser)
            .WithName("UpdateUser")
            .WithSummary("Update user");

        group.MapDelete("/{userId}", DeleteUser)
            .WithName("DeleteUser")
            .WithSummary("Delete user");

        group.MapPut("/{userId}/enabled", SetUserEnabled)
            .WithName("SetUserEnabled")
            .WithSummary("Enable or disable user");

        group.MapPost("/{userId}/reset-password", SendPasswordReset)
            .WithName("SendPasswordReset")
            .WithSummary("Send password reset email");

        group.MapGet("/{userId}/roles", GetUserRoles)
            .WithName("GetUserRoles")
            .WithSummary("Get user roles");

        group.MapPut("/{userId}/roles", UpdateUserRoles)
            .WithName("UpdateUserRoles")
            .WithSummary("Update user roles");

        group.MapGet("/roles", GetAvailableRoles)
            .WithName("GetAvailableRoles")
            .WithSummary("Get all available roles");
    }

    private static async Task<Results<Ok<UserListResponse>, ProblemHttpResult>> GetUsers(
        IKeycloakAdminService keycloakAdmin,
        string? search = null,
        int page = 1,
        int pageSize = 20,
        CancellationToken ct = default)
    {
        try
        {
            var first = (page - 1) * pageSize;
            var users = await keycloakAdmin.GetUsersAsync(search, first, pageSize, ct);
            var totalCount = await keycloakAdmin.GetUserCountAsync(ct);

            var response = new UserListResponse
            {
                Users = users.Select(MapToDto).ToList(),
                TotalCount = totalCount,
                Page = page,
                PageSize = pageSize
            };

            return TypedResults.Ok(response);
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to retrieve users");
        }
    }

    private static async Task<Results<Ok<int>, ProblemHttpResult>> GetUserCount(
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var count = await keycloakAdmin.GetUserCountAsync(ct);
            return TypedResults.Ok(count);
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to get user count");
        }
    }

    private static async Task<Results<Ok<UserDto>, NotFound, ProblemHttpResult>> GetUser(
        string userId,
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var user = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (user == null)
                return TypedResults.NotFound();

            var roles = await keycloakAdmin.GetUserRolesAsync(userId, ct);
            var dto = MapToDto(user);
            dto.Roles = roles.Select(r => r.Name).ToList();

            return TypedResults.Ok(dto);
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to retrieve user");
        }
    }

    private static async Task<Results<Created<UserDto>, Conflict<string>, ProblemHttpResult>> CreateUser(
        CreateUserRequest request,
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var keycloakRequest = new CreateKeycloakUserRequest
            {
                Username = request.Email, // Use email as username
                Email = request.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                Enabled = request.Enabled,
                EmailVerified = false,
                RequiredActions = request.SendInvitation
                    ? new List<string> { "UPDATE_PASSWORD", "VERIFY_EMAIL" }
                    : null
            };

            // Set temporary password if provided
            if (!string.IsNullOrEmpty(request.TemporaryPassword))
            {
                keycloakRequest.Credentials = new List<CredentialRepresentation>
                {
                    new() { Value = request.TemporaryPassword, Temporary = true }
                };
            }

            var userId = await keycloakAdmin.CreateUserAsync(keycloakRequest, ct);

            // Assign roles if specified
            if (request.Roles?.Count > 0)
            {
                await keycloakAdmin.AssignRolesToUserAsync(userId, request.Roles, ct);
            }

            // Send invitation email if requested
            if (request.SendInvitation)
            {
                await keycloakAdmin.SendPasswordResetEmailAsync(userId, ct);
            }

            var user = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            var dto = MapToDto(user!);
            dto.Roles = request.Roles ?? new List<string>();

            return TypedResults.Created($"/api/v1/users/{userId}", dto);
        }
        catch (KeycloakConflictException ex)
        {
            return TypedResults.Conflict(ex.Message);
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to create user");
        }
    }

    private static async Task<Results<Ok<UserDto>, NotFound, ProblemHttpResult>> UpdateUser(
        string userId,
        UpdateUserRequest request,
        IKeycloakAdminService keycloakAdmin,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        ILogger<Program> logger,
        CancellationToken ct = default)
    {
        try
        {
            var existingUser = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (existingUser == null)
                return TypedResults.NotFound();

            var keycloakRequest = new UpdateKeycloakUserRequest
            {
                Email = request.Email,
                Username = request.Email, // Keep username in sync with email
                FirstName = request.FirstName,
                LastName = request.LastName,
                Enabled = request.Enabled,
                EmailVerified = request.EmailVerified
            };

            await keycloakAdmin.UpdateUserAsync(userId, keycloakRequest, ct);

            // Handle member status based on user enabled state
            var keycloakUserId = Guid.Parse(userId);
            var existingMember = await memberRepository.GetByKeycloakUserIdAsync(keycloakUserId, ct);

            if (request.Enabled == true)
            {
                // If user is being activated, create member entry in database if not exists
                if (existingMember == null)
                {
                    logger.LogInformation("Creating member profile for user {Email} (Keycloak ID: {UserId})",
                        request.Email ?? existingUser.Email, userId);

                    // Create new member entry with placeholder address
                    var address = Address.CreateEmpty();

                    var member = Member.Create(
                        firstName: request.FirstName ?? existingUser.FirstName ?? "",
                        lastName: request.LastName ?? existingUser.LastName ?? "",
                        email: request.Email ?? existingUser.Email ?? "",
                        address: address,
                        membershipType: MembershipType.Regular
                    );

                    member.LinkToKeycloak(keycloakUserId);
                    member.Activate(); // Set status to Active

                    await memberRepository.AddAsync(member, ct);
                    await dbContext.SaveChangesAsync(ct);

                    logger.LogInformation("Successfully created member profile for {Email} with Member ID {MemberId}",
                        request.Email ?? existingUser.Email, member.Id);
                }
                else if (existingMember.Status != MembershipStatus.Active)
                {
                    // Reactivate existing member
                    logger.LogInformation("Reactivating member profile for user {Email} (Keycloak ID: {UserId})",
                        request.Email ?? existingUser.Email, userId);
                    existingMember.Activate();
                    await dbContext.SaveChangesAsync(ct);
                }
            }
            else if (request.Enabled == false && existingMember != null)
            {
                // If user is being deactivated, also deactivate the member
                logger.LogInformation("Deactivating member profile for user {Email} (Keycloak ID: {UserId})",
                    request.Email ?? existingUser.Email, userId);
                existingMember.Deactivate();
                await dbContext.SaveChangesAsync(ct);
            }

            var user = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            var roles = await keycloakAdmin.GetUserRolesAsync(userId, ct);
            var dto = MapToDto(user!);
            dto.Roles = roles.Select(r => r.Name).ToList();

            return TypedResults.Ok(dto);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update user {UserId}", userId);
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to update user");
        }
    }

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> DeleteUser(
        string userId,
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var existingUser = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (existingUser == null)
                return TypedResults.NotFound();

            await keycloakAdmin.DeleteUserAsync(userId, ct);
            return TypedResults.NoContent();
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to delete user");
        }
    }

    private static async Task<Results<Ok<UserDto>, NotFound, ProblemHttpResult>> SetUserEnabled(
        string userId,
        SetUserEnabledRequest request,
        IKeycloakAdminService keycloakAdmin,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        ILogger<Program> logger,
        CancellationToken ct = default)
    {
        try
        {
            var existingUser = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (existingUser == null)
                return TypedResults.NotFound();

            await keycloakAdmin.SetUserEnabledAsync(userId, request.Enabled, ct);

            // If user is being activated (or already active), create member entry in database if not exists
            if (request.Enabled)
            {
                var keycloakUserId = Guid.Parse(userId);
                var existingMember = await memberRepository.GetByKeycloakUserIdAsync(keycloakUserId, ct);

                if (existingMember == null)
                {
                    logger.LogInformation("Creating member profile for user {Email} (Keycloak ID: {UserId})",
                        existingUser.Email, userId);

                    // Create new member entry
                    var address = Address.Create(
                        street: "",
                        city: "",
                        postalCode: "",
                        country: "Schweiz"
                    );

                    var member = Member.Create(
                        firstName: existingUser.FirstName ?? "",
                        lastName: existingUser.LastName ?? "",
                        email: existingUser.Email ?? "",
                        address: address,
                        membershipType: MembershipType.Regular
                    );

                    member.LinkToKeycloak(keycloakUserId);
                    member.Activate(); // Set status to Active

                    await memberRepository.AddAsync(member, ct);
                    await dbContext.SaveChangesAsync(ct);

                    logger.LogInformation("Successfully created member profile for {Email} with Member ID {MemberId}",
                        existingUser.Email, member.Id);
                }
                else
                {
                    logger.LogDebug("Member profile already exists for user {Email}", existingUser.Email);
                }
            }

            var user = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            var roles = await keycloakAdmin.GetUserRolesAsync(userId, ct);
            var dto = MapToDto(user!);
            dto.Roles = roles.Select(r => r.Name).ToList();

            return TypedResults.Ok(dto);
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to update user status for {UserId}", userId);
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to update user status");
        }
    }

    private static async Task<Results<NoContent, NotFound, ProblemHttpResult>> SendPasswordReset(
        string userId,
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var existingUser = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (existingUser == null)
                return TypedResults.NotFound();

            await keycloakAdmin.SendPasswordResetEmailAsync(userId, ct);
            return TypedResults.NoContent();
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to send password reset email");
        }
    }

    private static async Task<Results<Ok<List<string>>, NotFound, ProblemHttpResult>> GetUserRoles(
        string userId,
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var existingUser = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (existingUser == null)
                return TypedResults.NotFound();

            var roles = await keycloakAdmin.GetUserRolesAsync(userId, ct);
            return TypedResults.Ok(roles.Select(r => r.Name).ToList());
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to get user roles");
        }
    }

    private static async Task<Results<Ok<List<string>>, NotFound, ProblemHttpResult>> UpdateUserRoles(
        string userId,
        UpdateUserRolesRequest request,
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var existingUser = await keycloakAdmin.GetUserByIdAsync(userId, ct);
            if (existingUser == null)
                return TypedResults.NotFound();

            var currentRoles = await keycloakAdmin.GetUserRolesAsync(userId, ct);
            var currentRoleNames = currentRoles.Select(r => r.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
            var targetRoles = request.Roles.ToHashSet(StringComparer.OrdinalIgnoreCase);

            var rolesToAdd = targetRoles.Except(currentRoleNames).ToList();
            var rolesToRemove = currentRoleNames.Except(targetRoles).ToList();

            if (rolesToAdd.Count > 0)
                await keycloakAdmin.AssignRolesToUserAsync(userId, rolesToAdd, ct);

            if (rolesToRemove.Count > 0)
                await keycloakAdmin.RemoveRolesFromUserAsync(userId, rolesToRemove, ct);

            var updatedRoles = await keycloakAdmin.GetUserRolesAsync(userId, ct);
            return TypedResults.Ok(updatedRoles.Select(r => r.Name).ToList());
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to update user roles");
        }
    }

    private static async Task<Results<Ok<List<RoleDto>>, ProblemHttpResult>> GetAvailableRoles(
        IKeycloakAdminService keycloakAdmin,
        CancellationToken ct = default)
    {
        try
        {
            var roles = await keycloakAdmin.GetAvailableRolesAsync(ct);
            var dtos = roles.Select(r => new RoleDto
            {
                Name = r.Name,
                Description = r.Description
            }).ToList();

            return TypedResults.Ok(dtos);
        }
        catch (Exception)
        {
            return TypedResults.Problem(
                detail: "An internal error occurred. Please try again later.",
                statusCode: 500,
                title: "Failed to get available roles");
        }
    }

    private static UserDto MapToDto(KeycloakUser user) => new()
    {
        Id = user.Id!,
        Email = user.Email,
        FirstName = user.FirstName,
        LastName = user.LastName,
        Enabled = user.Enabled,
        EmailVerified = user.EmailVerified,
        CreatedAt = user.CreatedTimestamp.HasValue
            ? DateTimeOffset.FromUnixTimeMilliseconds(user.CreatedTimestamp.Value).UtcDateTime
            : null
    };
}

// DTOs
public record UserListResponse
{
    public List<UserDto> Users { get; init; } = new();
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
}

public record UserDto
{
    public string Id { get; init; } = "";
    public string? Email { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public bool Enabled { get; init; }
    public bool EmailVerified { get; init; }
    public DateTime? CreatedAt { get; init; }
    public List<string> Roles { get; set; } = new();
}

public record CreateUserRequest
{
    public required string Email { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public bool Enabled { get; init; } = true;
    public bool SendInvitation { get; init; } = true;
    public string? TemporaryPassword { get; init; }
    public List<string>? Roles { get; init; }
}

public record UpdateUserRequest
{
    public string? Email { get; init; }
    public string? FirstName { get; init; }
    public string? LastName { get; init; }
    public bool? Enabled { get; init; }
    public bool? EmailVerified { get; init; }
}

public record SetUserEnabledRequest
{
    public bool Enabled { get; init; }
}

public record UpdateUserRolesRequest
{
    public List<string> Roles { get; init; } = new();
}

public record RoleDto
{
    public string Name { get; init; } = "";
    public string? Description { get; init; }
}
