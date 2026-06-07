using System.Security.Claims;
using System.Text.Encodings.Web;
using IabConnect.Application.Audit;
using IabConnect.Application.Integration;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;

namespace IabConnect.Api.Authentication;

/// <summary>
/// REQ-058 (E8-S1, AC-2/3/4/5): constants for the external API-key authentication scheme.
/// </summary>
public static class ApiKeyDefaults
{
    /// <summary>The second, named authentication scheme — applied per-route-group, never the default.</summary>
    public const string SchemeName = "ApiKey";

    /// <summary>The header an external integration presents its credential in.</summary>
    public const string HeaderName = "X-Api-Key";

    /// <summary>Claim type carrying each granted scope (consumed by <c>Scope:</c> authorization).</summary>
    public const string ScopeClaimType = "scope";
}

/// <summary>
/// REQ-058 (E8-S1): authenticates external API requests by a presented <see cref="ApiKeyDefaults.HeaderName"/>
/// credential. Structurally modeled on <c>TestAuthHandler</c> — a real
/// <see cref="AuthenticationHandler{TOptions}"/> registered as a SECOND named scheme alongside the
/// Keycloak JWT bearer; the default scheme is never changed.
///
/// <para><b>Additive by design:</b> when the header is absent the handler returns
/// <see cref="AuthenticateResult.NoResult"/> so existing JWT-protected routes keep their normal 401
/// behaviour — the new scheme introduces no regression. A PRESENT-but-invalid key (malformed,
/// unknown, revoked, or hash-mismatch) is an authentication FAILURE that is audited as
/// <see cref="AuditEventType.ApiClientAuthenticationFailed"/>.</para>
/// </summary>
public sealed class ApiKeyAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    private readonly IApiClientRepository _repository;
    private readonly IApiKeyHashingService _hashing;
    private readonly IAuditService _auditService;

    public ApiKeyAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder,
        IApiClientRepository repository,
        IApiKeyHashingService hashing,
        IAuditService auditService)
        : base(options, logger, encoder)
    {
        _repository = repository;
        _hashing = hashing;
        _auditService = auditService;
    }

    protected override async Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue(ApiKeyDefaults.HeaderName, out var headerValues)
            || string.IsNullOrWhiteSpace(headerValues))
        {
            // No key presented → stay anonymous; existing JWT 401 behaviour is preserved.
            return AuthenticateResult.NoResult();
        }

        var presentedKey = headerValues.ToString().Trim();

        if (!_hashing.TryParsePrefix(presentedKey, out var prefix))
            return await FailAsync("malformed", null);

        var client = await _repository.GetByPrefixAsync(prefix, Context.RequestAborted);
        if (client is null)
            return await FailAsync("unknown prefix", null);

        if (client.IsRevoked)
            return await FailAsync("credential revoked", client);

        if (!_hashing.Verify(presentedKey, client.SecretHash))
            return await FailAsync("hash mismatch", client);

        // Success — record last-used (best-effort; a write failure must never fail a valid auth).
        try
        {
            client.RecordUse(DateTime.UtcNow);
            await _repository.UpdateAsync(client, Context.RequestAborted);
        }
        catch (Exception ex)
        {
            Logger.LogWarning(ex, "API client {ClientId} authenticated but recording last-used failed.", client.Id);
        }

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, client.Id.ToString()),
            new("client_name", client.Name),
        };
        claims.AddRange(client.Scopes.Select(s => new Claim(ApiKeyDefaults.ScopeClaimType, s)));

        var identity = new ClaimsIdentity(claims, ApiKeyDefaults.SchemeName, ClaimTypes.NameIdentifier, ClaimTypes.Role);
        var ticket = new AuthenticationTicket(new ClaimsPrincipal(identity), ApiKeyDefaults.SchemeName);
        return AuthenticateResult.Success(ticket);
    }

    private async Task<AuthenticateResult> FailAsync(string reason, ApiClient? client)
    {
        Logger.LogWarning("API-key authentication failed: {Reason}", reason);

        // Audit the failure (AC-4). Best-effort: an audit failure must not mask the auth outcome.
        try
        {
            await _auditService.LogActionAsync(
                AuditEventType.ApiClientAuthenticationFailed,
                $"API-key authentication failed: {reason}",
                success: false,
                errorMessage: reason,
                entityType: "ApiClient",
                entityId: client?.Id.ToString(),
                ct: Context.RequestAborted);
        }
        catch (Exception ex)
        {
            Logger.LogError(ex, "Failed to write the ApiClientAuthenticationFailed audit event.");
        }

        return AuthenticateResult.Fail($"API-key authentication failed: {reason}");
    }
}
