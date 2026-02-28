using Amazon.S3;
using Hangfire;
using Hangfire.PostgreSql;
using IabConnect.Application.Audit;
using IabConnect.Application.Authorization;
using IabConnect.Application.Common;
using IabConnect.Application.Communication;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.EInvoice;
using IabConnect.Application.Finance.Invoices;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Documents;
using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Audit;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Finance;
using IabConnect.Infrastructure.Finance.EInvoice;
using IabConnect.Infrastructure.Finance.Jobs;
using IabConnect.Infrastructure.Identity;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using IabConnect.Infrastructure.Storage;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using QuestPDF.Infrastructure;

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
        services.AddScoped<Persistence.IUnitOfWork, UnitOfWork>();
        services.AddScoped<IabConnect.Application.Common.IUnitOfWork>(sp =>
            sp.GetRequiredService<Persistence.IUnitOfWork>());

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

        // REQ-069: Camt parser and bank import matcher
        services.AddScoped<IabConnect.Application.Finance.BankImports.ICamtParser, CamtParser>();
        services.AddScoped<IabConnect.Application.Finance.BankImports.IBankImportMatcher, BankImportMatcher>();
        services.AddScoped<IDunningNoticeRepository, DunningNoticeRepository>();
        services.AddScoped<IReceiptRepository, ReceiptRepository>();
        services.AddScoped<IFinanceProfileRepository, FinanceProfileRepository>();
        services.AddScoped<ITaxCodeRepository, TaxCodeRepository>();
        services.AddScoped<IFiscalPeriodRepository, FiscalPeriodRepository>();
        services.AddScoped<IExpenseClaimRepository, ExpenseClaimRepository>();
        services.AddScoped<IInvoiceTemplateRepository, InvoiceTemplateRepository>();
        services.AddScoped<IActivityAreaRepository, ActivityAreaRepository>();

        // REQ-065: eInvoice export (EN 16931 UBL)
        services.AddScoped<IEInvoiceExporter, UblInvoiceExporter>();

        // REQ-073: pain.001 ISO 20022 payment export
        services.AddScoped<Application.Finance.Exports.Pain001.IPain001Generator, Pain001Generator>();

        // REQ-072: eInvoice validation (EN 16931 baseline + CIUS extension point)
        services.AddScoped<IEInvoiceValidator, En16931Validator>();

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

        // REQ-039: Background job — mark overdue invoices
        services.AddScoped<IMarkInvoicesOverdueService, MarkInvoicesOverdueService>();
        services.AddScoped<MarkInvoicesOverdueJob>();

        // REQ-042: Background job — generate dunning notices
        services.AddScoped<IDunningScheduleService, DunningScheduleService>();
        services.AddScoped<DunningScheduleGenerationJob>();

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

        // REQ-061: Finance document storage (receipts)
        services.AddScoped<IFinanceDocumentStorage, FinanceDocumentStorage>();

        // REQ-039: Invoice PDF generation (QuestPDF)
        QuestPDF.Settings.License = LicenseType.Community;
        services.Configure<InvoiceSettings>(configuration.GetSection(InvoiceSettings.SectionName));
        services.AddScoped<QuestPdfInvoiceGenerator>();
        services.AddScoped<IInvoicePdfGenerator>(sp => sp.GetRequiredService<QuestPdfInvoiceGenerator>());

        // REQ-063: Swiss QR-bill invoice generator + factory
        services.AddScoped<SwissQrBillInvoiceGenerator>();
        services.AddScoped<IInvoicePdfGeneratorFactory, InvoicePdfGeneratorFactory>();

        // TODO: Add caching (Redis)

        return services;
    }
}
