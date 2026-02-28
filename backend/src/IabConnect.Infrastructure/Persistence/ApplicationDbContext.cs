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
    }

    public override async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        // TODO: Dispatch domain events before saving
        // TODO: Set audit fields (CreatedBy, UpdatedBy, etc.)

        return await base.SaveChangesAsync(cancellationToken);
    }
}
