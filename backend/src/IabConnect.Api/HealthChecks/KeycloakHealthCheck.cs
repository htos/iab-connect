using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IabConnect.Api.HealthChecks;

/// <summary>
/// REQ-054: Verifies Keycloak OIDC server is reachable.
/// </summary>
public class KeycloakHealthCheck(IConfiguration configuration, IHttpClientFactory httpClientFactory) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var authority = configuration["Authentication:Authority"];
            if (string.IsNullOrEmpty(authority))
                return HealthCheckResult.Degraded("Keycloak authority not configured.");

            var client = httpClientFactory.CreateClient();
            client.Timeout = TimeSpan.FromSeconds(5);

            var response = await client.GetAsync(
                $"{authority}/.well-known/openid-configuration",
                cancellationToken);

            return response.IsSuccessStatusCode
                ? HealthCheckResult.Healthy("Keycloak is reachable.")
                : HealthCheckResult.Unhealthy($"Keycloak returned {response.StatusCode}.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Keycloak health check failed.", ex);
        }
    }
}
