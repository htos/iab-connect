using Hangfire;
using Hangfire.PostgreSql;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace IabConnect.Infrastructure;

/// <summary>
/// Infrastructure layer dependency injection configuration
/// </summary>
public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        // Database
        var connectionString = configuration.GetConnectionString("DefaultConnection")
            ?? throw new InvalidOperationException("Connection string 'DefaultConnection' not found.");

        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseNpgsql(connectionString, npgsqlOptions =>
            {
                npgsqlOptions.MigrationsAssembly(typeof(ApplicationDbContext).Assembly.FullName);
                npgsqlOptions.EnableRetryOnFailure(3);
            });
        });

        // Unit of Work
        services.AddScoped<IUnitOfWork, UnitOfWork>();

        // Repositories
        services.AddScoped<IMemberRepository, MemberRepository>();
        // TODO: Add other repositories as modules are implemented

        // Hangfire (Background Jobs)
        services.AddHangfire(config =>
        {
            config
                .SetDataCompatibilityLevel(CompatibilityLevel.Version_180)
                .UseSimpleAssemblyNameTypeSerializer()
                .UseRecommendedSerializerSettings()
                .UsePostgreSqlStorage(options =>
                {
                    options.UseNpgsqlConnection(connectionString);
                });
        });
        services.AddHangfireServer();

        // TODO: Add MinIO file storage service
        // TODO: Add email service
        // TODO: Add caching (Redis)

        return services;
    }
}
