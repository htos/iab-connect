using IabConnect.Api;
using IabConnect.Application;
using IabConnect.Infrastructure;
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
