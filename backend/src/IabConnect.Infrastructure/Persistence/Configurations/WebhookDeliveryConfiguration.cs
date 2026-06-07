using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-058 (E8-S4): EF Core configuration for <see cref="WebhookDelivery"/>. The <c>DedupKey</c> is
/// uniquely indexed — this is the claim-before-send idempotency guard (A66/A67), mirroring the
/// automation-execution unique idempotency index.
/// </summary>
public sealed class WebhookDeliveryConfiguration : IEntityTypeConfiguration<WebhookDelivery>
{
    public void Configure(EntityTypeBuilder<WebhookDelivery> builder)
    {
        builder.ToTable("webhook_deliveries");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(e => e.SubscriptionId).HasColumnName("subscription_id").IsRequired();
        builder.Property(e => e.EventType).HasColumnName("event_type").HasMaxLength(100).IsRequired();
        builder.Property(e => e.TargetUrl).HasColumnName("target_url").HasMaxLength(2048).IsRequired();
        builder.Property(e => e.DedupKey).HasColumnName("dedup_key").HasMaxLength(200).IsRequired();
        builder.Property(e => e.Payload).HasColumnName("payload").IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(e => e.AttemptCount).HasColumnName("attempt_count").IsRequired();
        builder.Property(e => e.ResponseStatusCode).HasColumnName("response_status_code");
        builder.Property(e => e.Error).HasColumnName("error").HasMaxLength(1000);
        builder.Property(e => e.NextRetryAt).HasColumnName("next_retry_at");
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.LastAttemptAt).HasColumnName("last_attempt_at");

        builder.Ignore(e => e.DomainEvents);

        // Claim-before-send idempotency (A66/A67): a duplicate date-free key is rejected at commit.
        builder.HasIndex(e => e.DedupKey).IsUnique();
        builder.HasIndex(e => e.SubscriptionId);
        builder.HasIndex(e => e.CreatedAt);
    }
}
