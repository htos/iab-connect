using IabConnect.Domain.Audit;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for AuditEvent entity (REQ-011)
/// </summary>
public class AuditEventConfiguration : IEntityTypeConfiguration<AuditEvent>
{
    public void Configure(EntityTypeBuilder<AuditEvent> builder)
    {
        builder.ToTable("audit_events");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id");

        builder.Property(e => e.Timestamp)
            .HasColumnName("timestamp")
            .IsRequired();

        builder.Property(e => e.EventType)
            .HasColumnName("event_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Category)
            .HasColumnName("category")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.Severity)
            .HasColumnName("severity")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.UserId)
            .HasColumnName("user_id")
            .HasMaxLength(100);

        builder.Property(e => e.UserName)
            .HasColumnName("user_name")
            .HasMaxLength(255);

        builder.Property(e => e.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(50);

        builder.Property(e => e.UserAgent)
            .HasColumnName("user_agent")
            .HasMaxLength(500);

        builder.Property(e => e.EntityType)
            .HasColumnName("entity_type")
            .HasMaxLength(100);

        builder.Property(e => e.EntityId)
            .HasColumnName("entity_id")
            .HasMaxLength(100);

        builder.Property(e => e.Action)
            .HasColumnName("action")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.Details)
            .HasColumnName("details")
            .HasColumnType("jsonb");

        builder.Property(e => e.Success)
            .HasColumnName("success")
            .IsRequired();

        builder.Property(e => e.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(1000);

        // Indexes for common queries
        builder.HasIndex(e => e.Timestamp)
            .HasDatabaseName("ix_audit_events_timestamp");

        builder.HasIndex(e => e.EventType)
            .HasDatabaseName("ix_audit_events_event_type");

        builder.HasIndex(e => e.Category)
            .HasDatabaseName("ix_audit_events_category");

        builder.HasIndex(e => e.UserId)
            .HasDatabaseName("ix_audit_events_user_id");

        builder.HasIndex(e => new { e.EntityType, e.EntityId })
            .HasDatabaseName("ix_audit_events_entity");

        builder.HasIndex(e => e.Severity)
            .HasDatabaseName("ix_audit_events_severity");

        // Ignore inherited DomainEvents navigation
        builder.Ignore(e => e.DomainEvents);
    }
}
