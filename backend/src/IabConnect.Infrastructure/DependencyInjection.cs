using Amazon.S3;
using Hangfire;
using Hangfire.PostgreSql;
using IabConnect.Application.Audit;
using IabConnect.Application.Authorization;
using IabConnect.Application.Common;
using IabConnect.Application.Communication;
using IabConnect.Application.Finance;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Documents;
using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Audit;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Identity;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using IabConnect.Infrastructure.Storage;
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
        services.AddScoped<IEmailTemplateRepository, EmailTemplateRepository>();

        // REQ-059: System Settings & Custom Roles
        services.AddScoped<ISystemSettingsRepository, SystemSettingsRepository>();
        services.AddScoped<ICustomRoleRepository, CustomRoleRepository>();

        // REQ-038..045: Finance repositories
        services.AddScoped<IAccountRepository, AccountRepository>();
        services.AddScoped<ICategoryRepository, CategoryRepository>();
        services.AddScoped<ITransactionRepository, TransactionRepository>();
        services.AddScoped<IInvoiceRepository, InvoiceRepository>();
        services.AddScoped<IPaymentRepository, PaymentRepository>();
        services.AddScoped<IBankImportRepository, BankImportRepository>();
        services.AddScoped<IDunningNoticeRepository, DunningNoticeRepository>();
        services.AddScoped<IReceiptRepository, ReceiptRepository>();

        // REQ-034..037: Documents repositories
        services.AddScoped<IDocumentRepository, DocumentRepository>();
        services.AddScoped<IDocumentFolderRepository, DocumentFolderRepository>();

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

        // REQ-034: Document Storage (RustFS via S3 SDK)
        services.Configure<DocumentStorageSettings>(configuration.GetSection(DocumentStorageSettings.SectionName));
        var storageSettings = configuration.GetSection(DocumentStorageSettings.SectionName).Get<DocumentStorageSettings>()
            ?? new DocumentStorageSettings();
        services.AddSingleton<IAmazonS3>(_ =>
        {
            var config = new AmazonS3Config
            {
                ServiceURL = storageSettings.ServiceUrl,
                ForcePathStyle = true,
                UseHttp = !storageSettings.UseHttps
            };
            return new AmazonS3Client(storageSettings.AccessKey, storageSettings.SecretKey, config);
        });
        services.AddScoped<IDocumentStorage, S3DocumentStorage>();

        // TODO: Add caching (Redis)

        return services;
    }
}
