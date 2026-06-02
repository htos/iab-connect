using IabConnect.Api;
using IabConnect.Application;
using IabConnect.Infrastructure;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Serilog;

Log.Logger = new LoggerConfiguration()
    .MinimumLevel.Information()
    .WriteTo.Console()
    .CreateBootstrapLogger();

try
{
    Log.Information("Starting IAB Connect API");

    var builder = WebApplication.CreateBuilder(args);

    // Use Serilog instead of default logging
    builder.Host.UseSerilog((context, services, configuration) => configuration
        .ReadFrom.Configuration(context.Configuration)
        .ReadFrom.Services(services)
        .Enrich.FromLogContext());

    // Suppress Server header (SEC-012)
    builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

    // Add services
    builder.Services
        .AddApiServices(builder.Configuration, builder.Environment)
        .AddApplicationServices()
        .AddInfrastructureServices(builder.Configuration);

    var app = builder.Build();

    // Apply migrations automatically (skip in Testing environment)
    try
    {
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var env = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
            var configuration = scope.ServiceProvider.GetRequiredService<IConfiguration>();

            Log.Information("Environment: {Environment}", env.EnvironmentName);

            // REQ-088 AC-4 (E15-S2 / ADR-015): Database:AutoMigrate gates the versioned
            // EF Core MigrateAsync call. Default true preserves current Dev/Beta behaviour;
            // Production may flip to false via Database__AutoMigrate=false env var per the
            // E19-S2 manual-migration runbook so a rolling api restart cannot race the
            // schema migration. Testing branch above is intentionally not gated — it uses
            // EnsureCreatedAsync for per-test-class schema, not versioned migrations.
            var autoMigrate = Program.ShouldAutoMigrate(configuration);

            if (env.EnvironmentName == "Testing")
            {
                Log.Information("Testing environment detected — skipping migrations");
                await db.Database.EnsureCreatedAsync();
            }
            else if (env.IsDevelopment())
            {
                if (autoMigrate)
                {
                    Log.Information("Using migrations for development (shared database with Keycloak)");
                    // Always use migrations because EnsureCreated doesn't work when Keycloak
                    // has already created tables in the shared database
                    await db.Database.MigrateAsync();
                    Log.Information("Database migrations applied");
                }
                else
                {
                    Log.Information("Database migrations skipped (Database:AutoMigrate=false)");
                }

                // Seed development data (creates Member records for Keycloak users)
                try
                {
                    Log.Information("Seeding development data...");
                    await DevelopmentDataSeeder.SeedAsync(app.Services);
                    Log.Information("Development data seeding completed");
                }
                catch (Exception seedEx)
                {
                    Log.Warning(seedEx, "Development data seeding failed (non-fatal, continuing startup)");
                }

                // Seed realistic production-like data (idempotent)
                // Uncomment to re-seed: RealisticDataSeeder populates all domains with realistic data
                // try
                // {
                //     Log.Information("Seeding realistic data...");
                //     await RealisticDataSeeder.SeedAsync(app.Services);
                //     Log.Information("Realistic data seeding completed");
                // }
                // catch (Exception realisticEx)
                // {
                //     Log.Warning(realisticEx, "Realistic data seeding failed (non-fatal, continuing startup)");
                // }
            }
            else
            {
                if (autoMigrate)
                {
                    Log.Information("Using migrations for production");
                    // In production, use migrations
                    await db.Database.MigrateAsync();
                    Log.Information("Database migrations applied successfully");
                }
                else
                {
                    Log.Information("Database migrations skipped (Database:AutoMigrate=false)");
                }
            }

            // REQ-057: Seed default retention policies (idempotent — skips if already exist)
            try
            {
                var retentionService = scope.ServiceProvider.GetRequiredService<IabConnect.Application.Retention.IRetentionPolicyService>();
                await retentionService.SeedDefaultPoliciesAsync();
                Log.Information("Retention policies seeded");
            }
            catch (Exception rpEx)
            {
                Log.Warning(rpEx, "Retention policy seeding failed (non-fatal, continuing startup)");
            }
        }
    }
    catch (Exception ex)
    {
        Log.Error(ex, "Failed to apply database migrations");
        throw;
    }

    // Configure pipeline
    app.UseApiPipeline();

    app.Run();
}
catch (Exception ex) when (ex is not HostAbortedException)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
    throw;
}
finally
{
    Log.CloseAndFlush();
}

// Make Program accessible for integration tests
public partial class Program
{
    /// <summary>
    /// REQ-088 AC-4 (E15-S2 / ADR-015): Reads the <c>Database:AutoMigrate</c> toggle from
    /// configuration. Default <c>true</c> preserves current Dev/Beta behaviour (auto-apply
    /// EF Core versioned migrations on api boot). Production may set
    /// <c>Database__AutoMigrate=false</c> via env var to skip the startup migrate and apply
    /// migrations manually in a controlled change window per the E19-S2 runbook — required so
    /// a rolling api restart cannot race the schema migration and so a botched migration cannot
    /// corrupt the live schema during a normal deploy. The Testing branch in
    /// <c>Program.cs</c> bypasses this gate intentionally; it uses
    /// <see cref="ApplicationDbContext.Database.EnsureCreatedAsync"/> for per-test-class
    /// schema, not versioned migrations.
    /// </summary>
    internal static bool ShouldAutoMigrate(IConfiguration configuration) =>
        configuration.GetValue<bool>("Database:AutoMigrate", defaultValue: true);
}
