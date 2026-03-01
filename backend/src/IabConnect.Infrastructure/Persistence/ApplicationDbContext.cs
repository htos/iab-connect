using IabConnect.Domain.Audit;
using IabConnect.Domain.Authorization;
using IabConnect.Domain.Common;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Documents;
using IabConnect.Domain.Events;
using IabConnect.Domain.Finance;
using IabConnect.Domain.Members;
using IabConnect.Domain.Privacy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace IabConnect.Infrastructure.Persistence;

/// <summary>
/// Main application database context
/// </summary>
public sealed class ApplicationDbContext : DbContext
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public DbSet<Member> Members => Set<Member>();
    public DbSet<AuditEvent> AuditEvents => Set<AuditEvent>();
    public DbSet<Consent> Consents => Set<Consent>();
    public DbSet<DeletionRequest> DeletionRequests => Set<DeletionRequest>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<EventRegistration> EventRegistrations => Set<EventRegistration>();
    public DbSet<EmailCampaign> EmailCampaigns => Set<EmailCampaign>();
    public DbSet<EmailRecipient> EmailRecipients => Set<EmailRecipient>();
    public DbSet<EmailTemplate> EmailTemplates => Set<EmailTemplate>();
    public DbSet<SystemSettings> SystemSettings => Set<SystemSettings>();
    public DbSet<CustomRole> CustomRoles => Set<CustomRole>();

    // Finance (REQ-038..045)
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Invoice> Invoices => Set<Invoice>();
    public DbSet<InvoiceItem> InvoiceItems => Set<InvoiceItem>();
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<BankImport> BankImports => Set<BankImport>();
    public DbSet<BankImportItem> BankImportItems => Set<BankImportItem>();
    public DbSet<DunningNotice> DunningNotices => Set<DunningNotice>();
    public DbSet<Receipt> Receipts => Set<Receipt>();
    public DbSet<FinanceProfile> FinanceProfiles => Set<FinanceProfile>();
    public DbSet<TaxCode> TaxCodes => Set<TaxCode>();
    public DbSet<FiscalPeriod> FiscalPeriods => Set<FiscalPeriod>();
    public DbSet<ExpenseClaim> ExpenseClaims => Set<ExpenseClaim>();
    public DbSet<InvoiceTemplate> InvoiceTemplates => Set<InvoiceTemplate>();
    public DbSet<ActivityArea> ActivityAreas => Set<ActivityArea>();
    public DbSet<InvoiceNumberCounter> InvoiceNumberCounters => Set<InvoiceNumberCounter>();

    // REQ-074..085: Double-Entry Bookkeeping
    public DbSet<LedgerAccount> LedgerAccounts => Set<LedgerAccount>();
    public DbSet<JournalEntry> JournalEntries => Set<JournalEntry>();
    public DbSet<JournalEntryLine> JournalEntryLines => Set<JournalEntryLine>();
    public DbSet<PostingMapping> PostingMappings => Set<PostingMapping>();

    // Documents (REQ-034..037)
    public DbSet<DocumentFolder> DocumentFolders => Set<DocumentFolder>();
    public DbSet<Document> Documents => Set<Document>();
    public DbSet<DocumentVersion> DocumentVersions => Set<DocumentVersion>();
    public DbSet<DocumentTag> DocumentTags => Set<DocumentTag>();
    public DbSet<FolderPermission> FolderPermissions => Set<FolderPermission>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Ignore DomainEvent — it's an in-memory collection, not a DB entity
        modelBuilder.Ignore<IabConnect.Domain.Common.DomainEvent>();

        // Apply all configurations from assembly
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);

        // Configure soft delete global query filter for all entities
        // TODO: Apply to all aggregate roots

        // Npgsql 6+ requires DateTimeKind.Utc for timestamptz columns.
        // Apply UTC value converters globally to every DateTime / DateTime? property
        // so that Unspecified or Local values are normalised before reaching the driver.
        ApplyUtcDateTimeConverters(modelBuilder);
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // Belt-and-suspenders: normalise any remaining non-UTC DateTimes
        // that might slip past the value converter (e.g. shadow properties).
        ChangeTracker.DetectChanges();
        NormalizeDateTimesToUtc();

        return await base.SaveChangesAsync(cancellationToken);
    }

    /// <summary>
    /// Applies ValueConverters to all DateTime and DateTime? properties on every entity
    /// so that Npgsql always receives DateTimeKind.Utc values for timestamptz columns.
    /// </summary>
    private static void ApplyUtcDateTimeConverters(ModelBuilder modelBuilder)
    {
        var dateTimeConverter = new ValueConverter<DateTime, DateTime>(
            v => v.Kind == DateTimeKind.Utc ? v : DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc));

        var nullableDateTimeConverter = new ValueConverter<DateTime?, DateTime?>(
            v => !v.HasValue ? v
                : v.Value.Kind == DateTimeKind.Utc ? v
                : DateTime.SpecifyKind(v.Value, DateTimeKind.Utc),
            v => v.HasValue ? DateTime.SpecifyKind(v.Value, DateTimeKind.Utc) : v);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime))
                {
                    property.SetValueConverter(dateTimeConverter);
                }
                else if (property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(nullableDateTimeConverter);
                }
            }
        }
    }

    private void NormalizeDateTimesToUtc()
    {
        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.State is not (EntityState.Added or EntityState.Modified)) continue;

            foreach (var prop in entry.Properties)
            {
                if (prop.CurrentValue is DateTime dt && dt.Kind != DateTimeKind.Utc)
                {
                    prop.CurrentValue = DateTime.SpecifyKind(dt, DateTimeKind.Utc);
                }
            }
        }
    }
}
