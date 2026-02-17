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

            Log.Information("Environment: {Environment}", env.EnvironmentName);

            if (env.EnvironmentName == "Testing")
            {
                Log.Information("Testing environment detected — skipping migrations");
                await db.Database.EnsureCreatedAsync();
            }
            else if (env.IsDevelopment())
            {
                Log.Information("Using migrations for development (shared database with Keycloak)");
                // Always use migrations because EnsureCreated doesn't work when Keycloak
                // has already created tables in the shared database
                await db.Database.MigrateAsync();
                Log.Information("Database migrations applied");

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
            }
            else
            {
                Log.Information("Using migrations for production");
                // In production, use migrations
                await db.Database.MigrateAsync();
                Log.Information("Database migrations applied successfully");
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
public partial class Program { }
