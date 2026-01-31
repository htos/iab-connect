using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-026: EF Core configuration for EmailRecipient entity
/// </summary>
public sealed class EmailRecipientConfiguration : IEntityTypeConfiguration<EmailRecipient>
{
    public void Configure(EntityTypeBuilder<EmailRecipient> builder)
    {
        builder.ToTable("email_recipients");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.CampaignId)
            .HasColumnName("campaign_id")
            .IsRequired();

        builder.Property(e => e.MemberId)
            .HasColumnName("member_id");

        builder.Property(e => e.Email)
            .HasColumnName("email")
            .HasMaxLength(254)
            .IsRequired();

        builder.Property(e => e.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100);

        builder.Property(e => e.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100);

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.SentAt)
            .HasColumnName("sent_at");

        builder.Property(e => e.DeliveredAt)
            .HasColumnName("delivered_at");

        builder.Property(e => e.OpenedAt)
            .HasColumnName("opened_at");

        builder.Property(e => e.ClickedAt)
            .HasColumnName("clicked_at");

        builder.Property(e => e.BouncedAt)
            .HasColumnName("bounced_at");

        builder.Property(e => e.UnsubscribedAt)
            .HasColumnName("unsubscribed_at");

        builder.Property(e => e.BounceType)
            .HasColumnName("bounce_type")
            .HasConversion<string>()
            .HasMaxLength(10);

        builder.Property(e => e.BounceMessage)
            .HasColumnName("bounce_message")
            .HasMaxLength(1000);

        builder.Property(e => e.ErrorMessage)
            .HasColumnName("error_message")
            .HasMaxLength(1000);

        builder.Property(e => e.ExternalMessageId)
            .HasColumnName("external_message_id")
            .HasMaxLength(200);

        // Ignore inherited DomainEvents (from Entity base class)
        builder.Ignore(e => e.DomainEvents);

        // Indexes
        builder.HasIndex(e => e.CampaignId);
        builder.HasIndex(e => e.MemberId);
        builder.HasIndex(e => e.Email);
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.ExternalMessageId);
        builder.HasIndex(e => new { e.CampaignId, e.Email }).IsUnique();
    }
}
