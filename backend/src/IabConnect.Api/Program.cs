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

    // Add services
    builder.Services
        .AddApiServices(builder.Configuration)
        .AddApplicationServices()
        .AddInfrastructureServices(builder.Configuration);

    var app = builder.Build();

    // Apply migrations automatically
    try
    {
        using (var scope = app.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var env = scope.ServiceProvider.GetRequiredService<IHostEnvironment>();
            
            Log.Information("Environment: {Environment}", env.EnvironmentName);

            if (env.IsDevelopment())
            {
                Log.Information("Using EnsureCreated for development");
                // In development, use EnsureCreated for quick schema sync
                await db.Database.EnsureCreatedAsync();
                Log.Information("Database schema ensured");
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
catch (Exception ex)
{
    Log.Fatal(ex, "Application terminated unexpectedly");
}
finally
{
    Log.CloseAndFlush();
}

// Make Program accessible for integration tests
public partial class Program { }
