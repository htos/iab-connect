using IabConnect.Infrastructure.Persistence;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace IabConnect.Api.HealthChecks;

/// <summary>
/// REQ-054: Verifies PostgreSQL database connectivity.
/// </summary>
public class DatabaseHealthCheck(ApplicationDbContext db) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var canConnect = await db.Database.CanConnectAsync(cancellationToken);
            return canConnect
                ? HealthCheckResult.Healthy("PostgreSQL database is reachable.")
                : HealthCheckResult.Unhealthy("Cannot connect to PostgreSQL database.");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Database health check failed.", ex);
        }
    }
}
