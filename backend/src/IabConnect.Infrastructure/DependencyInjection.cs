using Amazon.S3;
using Hangfire;
using Hangfire.PostgreSql;
using IabConnect.Application.Audit;
using IabConnect.Application.Authorization;
using IabConnect.Application.Members;
using IabConnect.Application.Common;
using IabConnect.Application.Communication;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.EInvoice;
using IabConnect.Application.Finance.Invoices;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Application.Backup;
using IabConnect.Application.Retention;
using IabConnect.Application.Search;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Documents;
using IabConnect.Domain.Events;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using IabConnect.Domain.Blog;
using IabConnect.Domain.Sponsors;
using IabConnect.Infrastructure.Audit;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Finance;
using IabConnect.Infrastructure.Finance.EInvoice;
using IabConnect.Infrastructure.Finance.Jobs;
using IabConnect.Infrastructure.Identity;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using IabConnect.Infrastructure.Backup;
using IabConnect.Infrastructure.Retention;
using IabConnect.Infrastructure.Search;
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
        services.AddScoped<IMemberSegmentRepository, MemberSegmentRepository>();
        services.AddScoped<IAuditEventRepository, AuditEventRepository>();
        services.AddScoped<IConsentRepository, ConsentRepository>();
        services.AddScoped<IDeletionRequestRepository, DeletionRequestRepository>();
        services.AddScoped<IEventRepository, EventRepository>();
        services.AddScoped<IEventRegistrationRepository, EventRegistrationRepository>();
        services.AddScoped<IEventFeeCategoryRepository, EventFeeCategoryRepository>(); // REQ-022 (E4-S1)

        // REQ-024 (E3.S4): TimeProvider for testable time in the reminder service
        services.AddSingleton(TimeProvider.System);

        // REQ-024 (E3.S4): Hangfire wrapper for the volunteer-shift reminder job
        services.AddScoped<Infrastructure.Events.Jobs.VolunteerShiftReminderJob>();

        // REQ-024 (E3.S3): Volunteer-planning repositories + transactional assignment service
        services.AddScoped<IabConnect.Domain.Events.Volunteers.IEventVolunteerRoleRepository, EventVolunteerRoleRepository>();
        services.AddScoped<IabConnect.Domain.Events.Volunteers.IEventVolunteerShiftRepository, EventVolunteerShiftRepository>();
        services.AddScoped<IabConnect.Domain.Events.Volunteers.IEventVolunteerAssignmentRepository, EventVolunteerAssignmentRepository>();
        services.AddScoped<IabConnect.Application.Events.Volunteers.IEventVolunteerAssignmentService,
            Infrastructure.Events.Volunteers.EventVolunteerAssignmentService>();
        services.AddScoped<IEmailCampaignRepository, EmailCampaignRepository>();
        services.AddScoped<IEmailTemplateRepository, EmailTemplateRepository>();
        services.AddScoped<INewsletterSubscriberRepository, NewsletterSubscriberRepository>();

        // REQ-059: System Settings & Custom Roles
        services.AddScoped<ISystemSettingsRepository, SystemSettingsRepository>();
        services.AddScoped<ICustomRoleRepository, CustomRoleRepository>();

        // REQ-087 (E10-S1): Module settings — per-module enablement state
        services.AddScoped<IModuleSettingsRepository, ModuleSettingsRepository>();

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

        // REQ-031..033: Sponsors & Suppliers repositories
        services.AddScoped<ISponsorRepository, SponsorRepository>();
        services.AddScoped<ISupplierRepository, SupplierRepository>();

        // REQ-047: Blog repository
        services.AddScoped<IBlogPostRepository, BlogPostRepository>();

        // REQ-052: Global search service
        services.AddScoped<IGlobalSearchService, PostgresGlobalSearchService>();

        // REQ-053 / REQ-088 AC-6 (E15-S3): Backup service + Hangfire-resolvable job
        // classes. PostgresBackupService now depends on IAmazonS3 (registered above for
        // RustFS) + IHostEnvironment for the fail-fast-on-missing-encryption-key check.
        services.AddScoped<IBackupService, PostgresBackupService>();
        services.AddScoped<ScheduledBackupJob>();
        services.AddScoped<PruneOldBackupsJob>();

        // REQ-057: Retention policy & enforcement services
        services.AddScoped<IRetentionPolicyService, PostgresRetentionPolicyService>();
        services.AddScoped<IRetentionEnforcementService, RetentionEnforcementService>();
        services.AddScoped<RetentionEnforcementJob>();

        // REQ-049: Contact message repository
        services.AddScoped<IContactMessageRepository, ContactMessageRepository>();

        // REQ-074..085: Double-Entry Bookkeeping repositories
        services.AddScoped<ILedgerAccountRepository, LedgerAccountRepository>();
        services.AddScoped<IJournalEntryRepository, JournalEntryRepository>();
        services.AddScoped<IPostingMappingRepository, PostingMappingRepository>();

        // REQ-077: Accounting posting service (double-entry auto-posting)
        services.AddScoped<IabConnect.Application.Finance.Accounting.IAccountingPostingService, AccountingPostingService>();

        // Finance reset service (admin-only)
        services.AddScoped<IabConnect.Application.Finance.IFinanceResetService, Persistence.Services.FinanceResetService>();

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

        // REQ-018 (E2.S3): safe member-merge orchestration service
        services.AddScoped<IMemberMergeService, Infrastructure.Members.MemberMergeService>();

        // REQ-018 (E2.S4): duplicate-candidate dismissals repository (cross-table groups page)
        services.AddScoped<IDuplicateCandidateDismissalRepository, DuplicateCandidateDismissalRepository>();

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

        // REQ-086 (E9-S3): ICS feed PRODID — startup-bound, singleton-safe (the
        // CalendarFeedBuilder is a singleton). Default preserves the previous literal.
        // The builder lives in the Application project (no Options dependency there), so the
        // bound POCO is also exposed directly for plain constructor injection.
        services.Configure<Application.Events.Calendar.CalendarFeedSettings>(
            configuration.GetSection(Application.Events.Calendar.CalendarFeedSettings.SectionName));
        services.AddSingleton(sp =>
            sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<
                Application.Events.Calendar.CalendarFeedSettings>>().Value);

        // REQ-026: E-Mail-Kampagnen Job Service (Hangfire)
        services.AddScoped<IEmailCampaignJobService, EmailCampaignJobService>();
        services.AddScoped<EmailCampaignSendJob>();

        // REQ-029: Unsubscribe token service (HMAC-based)
        services.AddSingleton<IUnsubscribeTokenService, UnsubscribeTokenService>();

        // REQ-039: Background job — mark overdue invoices
        services.AddScoped<IMarkInvoicesOverdueService, MarkInvoicesOverdueService>();
        services.AddScoped<MarkInvoicesOverdueJob>();

        // REQ-042: Background job — generate dunning notices
        services.AddScoped<IDunningScheduleService, DunningScheduleService>();
        services.AddScoped<DunningScheduleGenerationJob>();

        // TECH-003: Dunning email service (sends dunning notice emails)
        services.AddScoped<IDunningEmailService, DunningEmailService>();

        // REQ-021: Event notification service (waitlist, promotion, registration emails)
        services.AddScoped<IabConnect.Application.Events.IEventNotificationService, Events.EventNotificationService>();

        // Event registration PDF export
        // REQ-086 (E9-S3): Scoped (was Singleton) so it can inject the Scoped
        // ISystemSettingsRepository for the configured organization name in the PDF header.
        services.AddScoped<IabConnect.Application.Events.IRegistrationPdfExporter, Events.EventRegistrationPdfExporter>();

        // REQ-023: Event check-in roster CSV export
        services.AddSingleton<IabConnect.Application.Events.CheckIn.IEventCheckInRosterCsvExporter, Events.EventCheckInRosterCsvExporter>();

        // REQ-023 (E3.S2): Transactional, FOR UPDATE row-locked check-in service
        services.AddScoped<IabConnect.Application.Events.CheckIn.IEventRegistrationCheckInService,
            Events.EventRegistrationCheckInService>();

        // REQ-025 (Epic-3-retro §9 / R3-H-S5-3): calendar-token HMAC pepper. Bound from the
        // `Auth` section; empty pepper => plain SHA-256 fallback (dev/CI default).
        services.Configure<Events.CalendarTokenOptions>(
            configuration.GetSection(Events.CalendarTokenOptions.SectionName));

        // REQ-025 (E3.S5 Round-3 R3-H-S5-5 / Epic-3-retro §9): transactional, FOR UPDATE
        // row-locked calendar-token rotate + revoke service
        services.AddScoped<IabConnect.Application.Events.Calendar.ICalendarTokenService,
            Events.CalendarTokenService>();

        // REQ-021 (E3.S2 H-S2-5 / Epic-3-retro §9): transactional, FOR UPDATE row-locked
        // registration cancellation + waitlist-promotion service
        services.AddScoped<IabConnect.Application.Events.IEventRegistrationCancellationService,
            Events.EventRegistrationCancellationService>();

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

        // In-memory caching. First cache in the codebase — introduced by REQ-087 (E10-S1)
        // for the module-settings service. A distributed cache (Redis) can replace this
        // later if multi-instance deployment requires it.
        services.AddMemoryCache();

        // REQ-087 (E10-S1): cached module-settings service (depends on IMemoryCache + repo)
        services.AddScoped<IModuleSettingsService, Persistence.Services.ModuleSettingsService>();

        return services;
    }
}
