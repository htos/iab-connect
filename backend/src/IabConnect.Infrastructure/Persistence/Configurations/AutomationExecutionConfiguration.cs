using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-028 (E5-S2): EF Core configuration for <see cref="AutomationExecution"/> + its
/// <see cref="AutomationRecipient"/> children. Mirrors the <see cref="EmailCampaignConfiguration"/>
/// shape; the recipient idempotency key carries a <b>unique index</b> — the structural duplicate
/// guard (AC-3).
/// </summary>
public sealed class AutomationExecutionConfiguration : IEntityTypeConfiguration<AutomationExecution>
{
    public void Configure(EntityTypeBuilder<AutomationExecution> builder)
    {
        builder.ToTable("automation_executions");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(e => e.DefinitionId).HasColumnName("definition_id").IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(e => e.StartedAt).HasColumnName("started_at").IsRequired();
        builder.Property(e => e.CompletedAt).HasColumnName("completed_at");
        builder.Property(e => e.TotalRecipients).HasColumnName("total_recipients").HasDefaultValue(0);
        builder.Property(e => e.SentCount).HasColumnName("sent_count").HasDefaultValue(0);
        builder.Property(e => e.FailedCount).HasColumnName("failed_count").HasDefaultValue(0);
        builder.Property(e => e.SkippedCount).HasColumnName("skipped_count").HasDefaultValue(0);

        builder.HasMany(e => e.Recipients)
            .WithOne()
            .HasForeignKey(r => r.ExecutionId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(e => e.DomainEvents);

        builder.HasIndex(e => e.DefinitionId);
        builder.HasIndex(e => e.StartedAt);
    }
}

/// <summary>REQ-028 (E5-S2): EF config for <see cref="AutomationRecipient"/>.</summary>
public sealed class AutomationRecipientConfiguration : IEntityTypeConfiguration<AutomationRecipient>
{
    public void Configure(EntityTypeBuilder<AutomationRecipient> builder)
    {
        builder.ToTable("automation_recipients");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(e => e.ExecutionId).HasColumnName("execution_id").IsRequired();
        builder.Property(e => e.UserId).HasColumnName("user_id");
        builder.Property(e => e.MemberId).HasColumnName("member_id");

        builder.Property(e => e.Email).HasColumnName("email").HasMaxLength(254).IsRequired();
        builder.Property(e => e.FirstName).HasColumnName("first_name").HasMaxLength(200);
        builder.Property(e => e.LastName).HasColumnName("last_name").HasMaxLength(200);

        builder.Property(e => e.Status)
            .HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(e => e.IdempotencyKey)
            .HasColumnName("idempotency_key").HasMaxLength(400).IsRequired();

        builder.Property(e => e.SentAt).HasColumnName("sent_at");
        builder.Property(e => e.ErrorMessage).HasColumnName("error_message");

        builder.Ignore(e => e.DomainEvents);

        // AC-3: the unique index is the structural duplicate guard for (definition, occurrence, recipient).
        builder.HasIndex(e => e.IdempotencyKey).IsUnique();
    }
}
