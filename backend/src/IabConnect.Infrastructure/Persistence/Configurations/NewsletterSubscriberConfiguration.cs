using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-029: EF Core configuration for NewsletterSubscriber entity
/// </summary>
public sealed class NewsletterSubscriberConfiguration : IEntityTypeConfiguration<NewsletterSubscriber>
{
    public void Configure(EntityTypeBuilder<NewsletterSubscriber> builder)
    {
        builder.ToTable("newsletter_subscribers");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Email)
            .HasColumnName("email")
            .HasMaxLength(254)
            .IsRequired();

        builder.HasIndex(e => e.Email)
            .IsUnique();

        builder.Property(e => e.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100);

        builder.Property(e => e.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100);

        builder.Property(e => e.IsActive)
            .HasColumnName("is_active")
            .IsRequired();

        builder.Property(e => e.SubscribedAt)
            .HasColumnName("subscribed_at")
            .IsRequired();

        builder.Property(e => e.UnsubscribedAt)
            .HasColumnName("unsubscribed_at");

        builder.Property(e => e.ConfirmedAt)
            .HasColumnName("confirmed_at");

        builder.Property(e => e.IpAddress)
            .HasColumnName("ip_address")
            .HasMaxLength(45);
    }
}
