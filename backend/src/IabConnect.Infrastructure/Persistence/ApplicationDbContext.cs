using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Events;
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
    // public DbSet<Document> Documents => Set<Document>();
    // public DbSet<Payment> Payments => Set<Payment>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

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
