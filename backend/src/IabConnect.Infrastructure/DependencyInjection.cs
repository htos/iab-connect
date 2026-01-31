using Hangfire;
using Hangfire.PostgreSql;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Audit;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Identity;
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
        services.AddScoped<IAuditEventRepository, AuditEventRepository>();
        services.AddScoped<IConsentRepository, ConsentRepository>();
        services.AddScoped<IDeletionRequestRepository, DeletionRequestRepository>();
        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<IEventRegistrationRepository, EventRegistrationRepository>();
        services.AddScoped<IEmailCampaignRepository, EmailCampaignRepository>();

        // REQ-011: Audit Service (requires IHttpContextAccessor)
        services.AddHttpContextAccessor();
        services.AddScoped<IAuditService, AuditService>();

        // Keycloak Admin Service (REQ-002: Benutzerverwaltung)
        services.AddHttpClient<IKeycloakAdminService, KeycloakAdminService>();

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

        // REQ-026: E-Mail-Sender
        services.Configure<SmtpSettings>(configuration.GetSection(SmtpSettings.SectionName));
        services.AddScoped<IEmailSender, SmtpEmailSender>();

        // REQ-026: E-Mail-Kampagnen Job Service (Hangfire)
        services.AddScoped<IEmailCampaignJobService, EmailCampaignJobService>();
        services.AddScoped<EmailCampaignSendJob>();

        // TODO: Add MinIO file storage service
        // TODO: Add caching (Redis)

        return services;
    }
}
