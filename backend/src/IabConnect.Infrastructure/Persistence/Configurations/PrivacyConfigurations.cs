using IabConnect.Domain.Privacy;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for Consent entity (REQ-012: DSGVO)
/// </summary>
public class ConsentConfiguration : IEntityTypeConfiguration<Consent>
{
    public void Configure(EntityTypeBuilder<Consent> builder)
    {
        builder.ToTable("consents");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id");

        builder.Property(c => c.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(c => c.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.IsGranted)
            .HasColumnName("is_granted")
            .IsRequired();

        builder.Property(c => c.GrantedAt)
            .HasColumnName("granted_at")
            .IsRequired();

        builder.Property(c => c.RevokedAt)
            .HasColumnName("revoked_at");

        builder.Property(c => c.PolicyVersion)
            .HasColumnName("policy_version")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(50);

        builder.Property(c => c.UserAgent)
            .HasColumnName("user_agent")
            .HasMaxLength(500);

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Index for querying user's consents
        builder.HasIndex(c => c.UserId)
            .HasDatabaseName("ix_consents_user_id");

        // Unique index for user + type combination
        builder.HasIndex(c => new { c.UserId, c.Type })
            .IsUnique()
            .HasDatabaseName("ix_consents_user_type");

        // Index for finding users with specific consent
        builder.HasIndex(c => new { c.Type, c.IsGranted })
            .HasDatabaseName("ix_consents_type_granted");
    }
}

/// <summary>
/// EF Core configuration for DeletionRequest entity (REQ-012: DSGVO)
/// </summary>
public class DeletionRequestConfiguration : IEntityTypeConfiguration<DeletionRequest>
{
    public void Configure(EntityTypeBuilder<DeletionRequest> builder)
    {
        builder.ToTable("deletion_requests");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id");

        builder.Property(r => r.UserId)
            .HasColumnName("user_id")
            .IsRequired();

        builder.Property(r => r.Email)
            .HasColumnName("email")
            .HasMaxLength(256)
            .IsRequired();

        builder.Property(r => r.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(r => r.RequestedAt)
            .HasColumnName("requested_at")
            .IsRequired();

        builder.Property(r => r.ConfirmedAt)
            .HasColumnName("confirmed_at");

        builder.Property(r => r.CompletedAt)
            .HasColumnName("completed_at");

        builder.Property(r => r.ConfirmationToken)
            .HasColumnName("confirmation_token")
            .HasMaxLength(100);

        builder.Property(r => r.TokenExpiresAt)
            .HasColumnName("token_expires_at");

        builder.Property(r => r.Reason)
            .HasColumnName("reason")
            .HasMaxLength(1000);

        builder.Property(r => r.AdminNotes)
            .HasColumnName("admin_notes")
            .HasMaxLength(2000);

        builder.Property(r => r.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(50);

        // Index for querying by user
        builder.HasIndex(r => r.UserId)
            .HasDatabaseName("ix_deletion_requests_user_id");

        // Index for querying by status
        builder.HasIndex(r => r.Status)
            .HasDatabaseName("ix_deletion_requests_status");

        // Index for token lookup
        builder.HasIndex(r => r.ConfirmationToken)
            .HasDatabaseName("ix_deletion_requests_token");
    }
}
