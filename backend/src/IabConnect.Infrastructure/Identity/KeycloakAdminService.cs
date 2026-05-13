using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Identity;

/// <summary>
/// Service for interacting with the Keycloak Admin REST API
/// REQ-002: Benutzerverwaltung
/// </summary>
public interface IKeycloakAdminService
{
    Task<KeycloakUser?> GetUserByIdAsync(string userId, CancellationToken ct = default);
    Task<KeycloakUser?> GetUserByEmailAsync(string email, CancellationToken ct = default);
    Task<IReadOnlyList<KeycloakUser>> GetUsersAsync(string? search = null, int? first = null, int? max = null, CancellationToken ct = default);
    Task<int> GetUserCountAsync(CancellationToken ct = default);
    Task<string> CreateUserAsync(CreateKeycloakUserRequest request, CancellationToken ct = default);
    Task UpdateUserAsync(string userId, UpdateKeycloakUserRequest request, CancellationToken ct = default);
    Task DeleteUserAsync(string userId, CancellationToken ct = default);
    Task SetUserEnabledAsync(string userId, bool enabled, CancellationToken ct = default);
    Task SendPasswordResetEmailAsync(string userId, CancellationToken ct = default);
    Task ResetUserMfaAsync(string userId, CancellationToken ct = default);
    Task<IReadOnlyList<KeycloakRole>> GetUserRolesAsync(string userId, CancellationToken ct = default);
    Task AssignRolesToUserAsync(string userId, IEnumerable<string> roleNames, CancellationToken ct = default);
    Task RemoveRolesFromUserAsync(string userId, IEnumerable<string> roleNames, CancellationToken ct = default);
    Task<IReadOnlyList<KeycloakRole>> GetAvailableRolesAsync(CancellationToken ct = default);
    Task<IReadOnlyList<KeycloakSessionRepresentation>> GetUserSessionsAsync(string userId, CancellationToken ct = default);
    Task RevokeSessionAsync(string sessionId, CancellationToken ct = default);
}

public class KeycloakAdminService : IKeycloakAdminService
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<KeycloakAdminService> _logger;
    private readonly KeycloakAdminSettings _settings;
    private readonly SemaphoreSlim _tokenSemaphore = new(1, 1);

    private string? _accessToken;
    private DateTime _tokenExpiry = DateTime.MinValue;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    public KeycloakAdminService(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<KeycloakAdminService> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        _settings = new KeycloakAdminSettings();
        configuration.GetSection("KeycloakAdmin").Bind(_settings);

        if (string.IsNullOrEmpty(_settings.BaseUrl))
            throw new InvalidOperationException("KeycloakAdmin:BaseUrl is not configured");
    }

    private string AdminApiBase => $"{_settings.BaseUrl}/admin/realms/{_settings.Realm}";

    private async Task EnsureTokenAsync(CancellationToken ct)
    {
        if (_accessToken != null && DateTime.UtcNow < _tokenExpiry.AddMinutes(-1))
            return;

        await _tokenSemaphore.WaitAsync(ct);
        try
        {
            // Double-check after acquiring lock
            if (_accessToken != null && DateTime.UtcNow < _tokenExpiry.AddMinutes(-1))
                return;

            var tokenUrl = $"{_settings.BaseUrl}/realms/{_settings.Realm}/protocol/openid-connect/token";
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "client_credentials",
                ["client_id"] = _settings.ClientId,
                ["client_secret"] = _settings.ClientSecret
            });

            var response = await _httpClient.PostAsync(tokenUrl, content, ct);
            response.EnsureSuccessStatusCode();

            var tokenResponse = await response.Content.ReadFromJsonAsync<TokenResponse>(ct);
            _accessToken = tokenResponse?.AccessToken;
            _tokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse?.ExpiresIn ?? 300);

            _logger.LogDebug("Obtained new Keycloak admin token, expires at {Expiry}", _tokenExpiry);
        }
        finally
        {
            _tokenSemaphore.Release();
        }
    }

    private async Task<HttpRequestMessage> CreateRequestAsync(HttpMethod method, string url, CancellationToken ct)
    {
        await EnsureTokenAsync(ct);
        var request = new HttpRequestMessage(method, url);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _accessToken);
        return request;
    }

    public async Task<KeycloakUser?> GetUserByIdAsync(string userId, CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/users/{userId}", ct);
        var response = await _httpClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
            return null;

        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<KeycloakUser>(JsonOptions, ct);
    }

    public async Task<KeycloakUser?> GetUserByEmailAsync(string email, CancellationToken ct = default)
    {
        var users = await GetUsersAsync(email, 0, 1, ct);
        return users.FirstOrDefault(u => u.Email?.Equals(email, StringComparison.OrdinalIgnoreCase) == true);
    }

    public async Task<IReadOnlyList<KeycloakUser>> GetUsersAsync(string? search = null, int? first = null, int? max = null, CancellationToken ct = default)
    {
        var query = new List<string>();
        if (!string.IsNullOrEmpty(search)) query.Add($"search={Uri.EscapeDataString(search)}");
        if (first.HasValue) query.Add($"first={first.Value}");
        if (max.HasValue) query.Add($"max={max.Value}");

        var queryString = query.Count > 0 ? "?" + string.Join("&", query) : "";
        var request = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/users{queryString}", ct);
        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        return await response.Content.ReadFromJsonAsync<List<KeycloakUser>>(JsonOptions, ct) ?? [];
    }

    public async Task<int> GetUserCountAsync(CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/users/count", ct);
        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var content = await response.Content.ReadAsStringAsync(ct);
        return int.TryParse(content, out var count) ? count : 0;
    }

    public async Task<string> CreateUserAsync(CreateKeycloakUserRequest userRequest, CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Post, $"{AdminApiBase}/users", ct);
        request.Content = JsonContent.Create(userRequest, options: JsonOptions);

        var response = await _httpClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            throw new KeycloakConflictException("User with this email or username already exists");
        }

        response.EnsureSuccessStatusCode();

        // Extract user ID from Location header
        var location = response.Headers.Location?.ToString();
        var userId = location?.Split('/').LastOrDefault();

        if (string.IsNullOrEmpty(userId))
        {
            // Fallback: fetch user by email
            var createdUser = await GetUserByEmailAsync(userRequest.Email!, ct);
            userId = createdUser?.Id;
        }

        _logger.LogInformation("Created Keycloak user {UserId} with email {Email}", userId, userRequest.Email);
        return userId ?? throw new InvalidOperationException("Could not determine created user ID");
    }

    public async Task UpdateUserAsync(string userId, UpdateKeycloakUserRequest userRequest, CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Put, $"{AdminApiBase}/users/{userId}", ct);
        request.Content = JsonContent.Create(userRequest, options: JsonOptions);

        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Updated Keycloak user {UserId}", userId);
    }

    public async Task DeleteUserAsync(string userId, CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Delete, $"{AdminApiBase}/users/{userId}", ct);
        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Deleted Keycloak user {UserId}", userId);
    }

    public async Task SetUserEnabledAsync(string userId, bool enabled, CancellationToken ct = default)
    {
        await UpdateUserAsync(userId, new UpdateKeycloakUserRequest { Enabled = enabled }, ct);
        _logger.LogInformation("Set Keycloak user {UserId} enabled={Enabled}", userId, enabled);
    }

    public async Task SendPasswordResetEmailAsync(string userId, CancellationToken ct = default)
    {
        // S2.2: validate userId is a GUID before embedding into the Admin API URL (path-traversal defence,
        // symmetric with the existing GuidTryParse on GetUserSessionsAsync / RevokeSessionAsync).
        if (!Guid.TryParse(userId, out _))
            throw new ArgumentException($"userId must be a valid GUID, got: {userId}", nameof(userId));

        var request = await CreateRequestAsync(HttpMethod.Put, $"{AdminApiBase}/users/{userId}/execute-actions-email", ct);
        request.Content = JsonContent.Create(new[] { "UPDATE_PASSWORD" }, options: JsonOptions);

        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Sent password reset email to Keycloak user {UserId}", userId);
    }

    public async Task ResetUserMfaAsync(string userId, CancellationToken ct = default)
    {
        // S2.2: validate userId is a GUID before embedding into the Admin API URL.
        if (!Guid.TryParse(userId, out _))
            throw new ArgumentException($"userId must be a valid GUID, got: {userId}", nameof(userId));

        var credentialsRequest = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/users/{userId}/credentials", ct);
        var credentialsResponse = await _httpClient.SendAsync(credentialsRequest, ct);

        if (credentialsResponse.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new KeycloakNotFoundException($"User {userId} was not found");
        }

        credentialsResponse.EnsureSuccessStatusCode();

        var credentials = await credentialsResponse.Content.ReadFromJsonAsync<List<KeycloakCredentialRepresentation>>(JsonOptions, ct) ?? [];
        var mfaCredentials = credentials
            .Where(credential => IsMfaCredentialType(credential.Type))
            .ToList();

        // P4: Best-effort deletion — log warnings on individual failures but always attempt the
        // reconfiguration email so the user receives re-enrollment instructions even on partial cleanup.
        var deletedCount = 0;
        foreach (var credential in mfaCredentials)
        {
            if (string.IsNullOrWhiteSpace(credential.Id))
                continue;

            var deleteRequest = await CreateRequestAsync(HttpMethod.Delete, $"{AdminApiBase}/users/{userId}/credentials/{credential.Id}", ct);
            var deleteResponse = await _httpClient.SendAsync(deleteRequest, ct);
            if (deleteResponse.IsSuccessStatusCode)
            {
                deletedCount++;
            }
            else
            {
                _logger.LogWarning(
                    "Failed to delete MFA credential {CredentialId} for user {UserId}: {StatusCode}",
                    credential.Id, userId, deleteResponse.StatusCode);
            }
        }

        var actionsRequest = await CreateRequestAsync(HttpMethod.Put, $"{AdminApiBase}/users/{userId}/execute-actions-email", ct);
        actionsRequest.Content = JsonContent.Create(MfaReconfigurationActions, options: JsonOptions);

        var actionsResponse = await _httpClient.SendAsync(actionsRequest, ct);

        // S2.3: Keycloak returns 400 when the target user has no verified email — at this point
        // the MFA credentials have already been deleted, so this is not a plain infrastructure
        // failure. Surface it as a distinct domain-level exception so the API layer can return
        // a meaningful 422 response and the operator knows the user is now in a credential-less
        // state without a re-enrolment link.
        if (actionsResponse.StatusCode == System.Net.HttpStatusCode.BadRequest)
        {
            _logger.LogWarning(
                "Keycloak rejected execute-actions-email for user {UserId} after MFA deletion ({DeletedCount}/{TotalCount} credentials deleted) — likely no verified email address",
                userId, deletedCount, mfaCredentials.Count);
            throw new KeycloakActionEmailUnavailableException(
                $"Could not send MFA reconfiguration email for user {userId}: Keycloak rejected the request (likely no verified email).",
                deletedCount,
                mfaCredentials.Count);
        }

        actionsResponse.EnsureSuccessStatusCode();

        _logger.LogInformation(
            "Reset MFA credentials for Keycloak user {UserId}; deleted {DeletedCount}/{TotalCount} MFA credentials and sent reconfiguration actions",
            userId, deletedCount, mfaCredentials.Count);
    }

    public async Task<IReadOnlyList<KeycloakRole>> GetUserRolesAsync(string userId, CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/users/{userId}/role-mappings/realm", ct);
        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var roles = await response.Content.ReadFromJsonAsync<List<KeycloakRole>>(JsonOptions, ct) ?? [];
        // Filter out default/system roles - only return application-specific roles
        return roles.Where(r => !r.Name.StartsWith("default-roles-") &&
                               !r.Name.StartsWith("uma_") &&
                               r.Name != "offline_access").ToList();
    }

    public async Task<IReadOnlyList<KeycloakRole>> GetAvailableRolesAsync(CancellationToken ct = default)
    {
        var request = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/roles", ct);
        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        var roles = await response.Content.ReadFromJsonAsync<List<KeycloakRole>>(JsonOptions, ct) ?? [];
        // Filter out default roles
        return roles.Where(r => !r.Name.StartsWith("default-roles-") &&
                               !r.Name.StartsWith("uma_") &&
                               r.Name != "offline_access").ToList();
    }

    public async Task AssignRolesToUserAsync(string userId, IEnumerable<string> roleNames, CancellationToken ct = default)
    {
        var allRoles = await GetAvailableRolesAsync(ct);
        var rolesToAssign = allRoles.Where(r => roleNames.Contains(r.Name, StringComparer.OrdinalIgnoreCase)).ToList();

        if (rolesToAssign.Count == 0) return;

        var request = await CreateRequestAsync(HttpMethod.Post, $"{AdminApiBase}/users/{userId}/role-mappings/realm", ct);
        request.Content = JsonContent.Create(rolesToAssign, options: JsonOptions);

        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Assigned roles {Roles} to user {UserId}", string.Join(", ", roleNames), userId);
    }

    public async Task RemoveRolesFromUserAsync(string userId, IEnumerable<string> roleNames, CancellationToken ct = default)
    {
        var allRoles = await GetAvailableRolesAsync(ct);
        var rolesToRemove = allRoles.Where(r => roleNames.Contains(r.Name, StringComparer.OrdinalIgnoreCase)).ToList();

        if (rolesToRemove.Count == 0) return;

        var request = await CreateRequestAsync(HttpMethod.Delete, $"{AdminApiBase}/users/{userId}/role-mappings/realm", ct);
        request.Content = JsonContent.Create(rolesToRemove, options: JsonOptions);

        var response = await _httpClient.SendAsync(request, ct);
        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Removed roles {Roles} from user {UserId}", string.Join(", ", roleNames), userId);
    }

    public async Task<IReadOnlyList<KeycloakSessionRepresentation>> GetUserSessionsAsync(string userId, CancellationToken ct = default)
    {
        // P1: Validate userId is a GUID before interpolating into the Admin API URL.
        if (!Guid.TryParse(userId, out _))
            throw new ArgumentException($"userId must be a valid GUID, got: {userId}", nameof(userId));

        var request = await CreateRequestAsync(HttpMethod.Get, $"{AdminApiBase}/users/{userId}/sessions", ct);
        var response = await _httpClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new KeycloakNotFoundException($"User {userId} was not found");
        }

        response.EnsureSuccessStatusCode();

        var sessions = await response.Content.ReadFromJsonAsync<List<KeycloakSessionRepresentation>>(JsonOptions, ct) ?? [];
        return sessions;
    }

    public async Task RevokeSessionAsync(string sessionId, CancellationToken ct = default)
    {
        // P1: Validate sessionId is a GUID before interpolating into the Admin API URL.
        if (!Guid.TryParse(sessionId, out _))
            throw new ArgumentException($"sessionId must be a valid GUID, got: {sessionId}", nameof(sessionId));

        var request = await CreateRequestAsync(HttpMethod.Delete, $"{AdminApiBase}/sessions/{sessionId}", ct);
        var response = await _httpClient.SendAsync(request, ct);

        if (response.StatusCode == System.Net.HttpStatusCode.NotFound)
        {
            throw new KeycloakNotFoundException($"Session {sessionId} was not found");
        }

        response.EnsureSuccessStatusCode();

        _logger.LogInformation("Revoked Keycloak session {SessionId}", sessionId);
    }

    private static readonly string[] MfaReconfigurationActions = ["CONFIGURE_TOTP", "CONFIGURE_RECOVERY_AUTHN_CODES"];

    private static bool IsMfaCredentialType(string? credentialType) =>
        credentialType is not null
        && (credentialType.Equals("otp", StringComparison.OrdinalIgnoreCase)
            || credentialType.Equals("recovery-authn-codes", StringComparison.OrdinalIgnoreCase));
}

public class KeycloakAdminSettings
{
    public string BaseUrl { get; set; } = "http://localhost:8080";
    public string Realm { get; set; } = "iabconnect";
    public string ClientId { get; set; } = "iabconnect-admin";
    public string ClientSecret { get; set; } = "";
}

public class TokenResponse
{
    [JsonPropertyName("access_token")]
    public string? AccessToken { get; set; }

    [JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }
}

public class KeycloakUser
{
    public string? Id { get; set; }
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool Enabled { get; set; }
    public bool EmailVerified { get; set; }
    public long? CreatedTimestamp { get; set; }
    public Dictionary<string, List<string>>? Attributes { get; set; }
}

public class KeycloakRole
{
    public string? Id { get; set; }
    public string Name { get; set; } = "";
    public string? Description { get; set; }
}

public class KeycloakCredentialRepresentation
{
    public string? Id { get; set; }
    public string? Type { get; set; }
    public string? UserLabel { get; set; }
    public long? CreatedDate { get; set; }
}

/// <summary>
/// Keycloak UserSessionRepresentation. Mirrors the Admin REST API response
/// from GET /admin/realms/{realm}/users/{userId}/sessions.
/// All fields except Id are best-effort; Keycloak may omit details (e.g. IpAddress)
/// depending on event/session configuration and provider data.
/// </summary>
public class KeycloakSessionRepresentation
{
    public string? Id { get; set; }
    public string? Username { get; set; }
    public string? UserId { get; set; }
    public string? IpAddress { get; set; }
    public long? Start { get; set; }
    public long? LastAccess { get; set; }
    public Dictionary<string, string>? Clients { get; set; }
}

public class CreateKeycloakUserRequest
{
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool Enabled { get; set; } = true;
    public bool EmailVerified { get; set; } = false;
    public List<CredentialRepresentation>? Credentials { get; set; }
    public List<string>? RequiredActions { get; set; }
}

public class UpdateKeycloakUserRequest
{
    public string? Username { get; set; }
    public string? Email { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public bool? Enabled { get; set; }
    public bool? EmailVerified { get; set; }
}

public class CredentialRepresentation
{
    public string Type { get; set; } = "password";
    public string? Value { get; set; }
    public bool Temporary { get; set; } = true;
}

public class KeycloakConflictException : Exception
{
    public KeycloakConflictException(string message) : base(message) { }
}

public class KeycloakNotFoundException : Exception
{
    public KeycloakNotFoundException(string message) : base(message) { }
}

/// <summary>
/// Raised when Keycloak's <c>execute-actions-email</c> request fails with a 400 response,
/// typically because the target user has no verified email address. This is a distinct
/// domain condition from a generic infrastructure failure: the MFA credentials have
/// already been deleted at this point, but the re-enrolment email could not be sent.
/// The API layer should surface this to admin callers (e.g. as 422) so they know the
/// user is in a no-MFA, no-email-link state and needs out-of-band recovery.
/// </summary>
public class KeycloakActionEmailUnavailableException : Exception
{
    public int DeletedCredentialCount { get; }
    public int TotalCredentialCount { get; }

    public KeycloakActionEmailUnavailableException(string message, int deletedCredentialCount, int totalCredentialCount)
        : base(message)
    {
        DeletedCredentialCount = deletedCredentialCount;
        TotalCredentialCount = totalCredentialCount;
    }
}
