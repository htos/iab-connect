using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-058 (E8-S3): EF Core configuration for <see cref="WebhookSubscription"/>. The subscribed
/// event-type set is stored as a single comma-joined column; the signing secret is stored encrypted
/// (<c>secret_cipher</c>).
/// </summary>
public sealed class WebhookSubscriptionConfiguration : IEntityTypeConfiguration<WebhookSubscription>
{
    public void Configure(EntityTypeBuilder<WebhookSubscription> builder)
    {
        builder.ToTable("webhook_subscriptions");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(200).IsRequired();
        builder.Property(e => e.TargetUrl).HasColumnName("target_url").HasMaxLength(2048).IsRequired();
        builder.Property(e => e.SecretCipher).HasColumnName("secret_cipher").HasMaxLength(512).IsRequired();

        var converter = new ValueConverter<IReadOnlyCollection<string>, string>(
            v => string.Join(',', v),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList());
        var comparer = new ValueComparer<IReadOnlyCollection<string>>(
            (a, b) => (a ?? new List<string>()).SequenceEqual(b ?? new List<string>()),
            v => v.Aggregate(0, (hash, s) => HashCode.Combine(hash, s.GetHashCode())),
            v => v.ToList());

        builder.Property(e => e.EventTypes)
            .HasColumnName("event_types")
            .HasMaxLength(500)
            .HasConversion(converter, comparer)
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // REQ-058 (E8-S4): consecutive-failure counter driving the auto-pause policy.
        builder.Property(e => e.ConsecutiveFailureCount)
            .HasColumnName("consecutive_failure_count")
            .IsRequired();

        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");

        builder.Ignore(e => e.DomainEvents);

        builder.HasIndex(e => e.Status);
    }
}
