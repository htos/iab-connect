using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Identity;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Public registration endpoint for new users
/// Users are created in Keycloak but disabled until admin approval
/// Member entry is created when admin activates the user
/// </summary>
public static class RegistrationEndpoints
{
    public static void MapRegistrationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/v1/registration")
            .WithTags("Registration")
            .AllowAnonymous(); // Public endpoint - no authentication required

        group.MapPost("/", RegisterUser)
            .WithName("RegisterUser")
            .WithSummary("Register a new user account (requires admin approval)");
    }

    /// <summary>
    /// Register a new user - creates disabled account in Keycloak
    /// Member entry will be created when admin activates the user
    /// </summary>
    private static async Task<Results<Ok<RegistrationResponse>, BadRequest<RegistrationError>, Conflict<RegistrationError>>> RegisterUser(
        RegisterUserRequest request,
        IKeycloakAdminService keycloakService,
        IMemberRepository memberRepository,
        ILogger<Program> logger)
    {
        // Validate request
        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return TypedResults.BadRequest(new RegistrationError
            {
                Title = "Validation Error",
                Detail = "Email is required",
                Status = 400
            });
        }

        if (string.IsNullOrWhiteSpace(request.Password) || request.Password.Length < 8)
        {
            return TypedResults.BadRequest(new RegistrationError
            {
                Title = "Validation Error",
                Detail = "Password must be at least 8 characters",
                Status = 400
            });
        }

        if (string.IsNullOrWhiteSpace(request.FirstName) || string.IsNullOrWhiteSpace(request.LastName))
        {
            return TypedResults.BadRequest(new RegistrationError
            {
                Title = "Validation Error",
                Detail = "First name and last name are required",
                Status = 400
            });
        }

        try
        {
            // Check if user already exists in Keycloak
            var existingUsers = await keycloakService.GetUsersAsync(search: request.Email);
            if (existingUsers.Any(u => u.Email?.Equals(request.Email, StringComparison.OrdinalIgnoreCase) == true))
            {
                return TypedResults.Conflict(new RegistrationError
                {
                    Title = "User already exists",
                    Detail = "A user with this email address already exists",
                    Status = 409
                });
            }

            // REQ-018 (E2.S2): normalized-email check stays in sync with the symmetric guard.
            if (await memberRepository.EmailExistsNormalizedAsync(request.Email))
            {
                return TypedResults.Conflict(new RegistrationError
                {
                    Title = "User already exists",
                    Detail = "A member with this email address already exists",
                    Status = 409
                });
            }

            // Create user in Keycloak - DISABLED by default
            var createRequest = new CreateKeycloakUserRequest
            {
                Email = request.Email,
                Username = request.Email,
                FirstName = request.FirstName,
                LastName = request.LastName,
                Enabled = false, // User must be approved by admin
                EmailVerified = false,
                Credentials = new List<CredentialRepresentation>
                {
                    new()
                    {
                        Type = "password",
                        Value = request.Password,
                        Temporary = false
                    }
                },
                RequiredActions = new List<string> { "VERIFY_EMAIL" }
            };

            var userId = await keycloakService.CreateUserAsync(createRequest);

            if (string.IsNullOrEmpty(userId))
            {
                return TypedResults.BadRequest(new RegistrationError
                {
                    Title = "Registration failed",
                    Detail = "Could not create user account",
                    Status = 400
                });
            }

            // Assign member role
            try
            {
                await keycloakService.AssignRolesToUserAsync(userId, new[] { "member" });
            }
            catch (Exception ex)
            {
                logger.LogWarning(ex, "Could not assign member role to new user {UserId}", userId);
            }

            // Note: Member entry in database will be created when admin activates the user
            // This allows admin to review and approve registrations before creating member profiles

            logger.LogInformation("New user registered: {Email} (ID: {UserId}) - awaiting admin approval",
                request.Email, userId);

            return TypedResults.Ok(new RegistrationResponse
            {
                Success = true,
                Message = "Registration successful. Your account needs to be approved by an administrator before you can log in."
            });
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Failed to register user {Email}", request.Email);
            return TypedResults.BadRequest(new RegistrationError
            {
                Title = "Registration failed",
                Detail = "An error occurred during registration. Please try again later.",
                Status = 400
            });
        }
    }
}

/// <summary>
/// Request model for user registration
/// </summary>
public record RegisterUserRequest
{
    public required string Email { get; init; }
    public required string Password { get; init; }
    public required string FirstName { get; init; }
    public required string LastName { get; init; }
}

/// <summary>
/// Response model for registration
/// </summary>
public record RegistrationResponse
{
    public bool Success { get; init; }
    public required string Message { get; init; }
}

/// <summary>
/// Error details for registration API errors
/// </summary>
public class RegistrationError
{
    public string? Title { get; set; }
    public string? Detail { get; set; }
    public int Status { get; set; }
}
