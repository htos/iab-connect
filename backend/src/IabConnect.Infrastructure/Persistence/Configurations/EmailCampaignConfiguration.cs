using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-026: EF Core configuration for EmailCampaign entity
/// </summary>
public sealed class EmailCampaignConfiguration : IEntityTypeConfiguration<EmailCampaign>
{
    public void Configure(EntityTypeBuilder<EmailCampaign> builder)
    {
        builder.ToTable("email_campaigns");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Subject)
            .HasColumnName("subject")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(e => e.HtmlContent)
            .HasColumnName("html_content")
            .IsRequired();

        builder.Property(e => e.PlainTextContent)
            .HasColumnName("plain_text_content");

        builder.Property(e => e.FromName)
            .HasColumnName("from_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(e => e.FromEmail)
            .HasColumnName("from_email")
            .HasMaxLength(254)
            .IsRequired();

        builder.Property(e => e.ReplyToEmail)
            .HasColumnName("reply_to_email")
            .HasMaxLength(254);

        builder.Property(e => e.SegmentType)
            .HasColumnName("segment_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.SegmentFilter)
            .HasColumnName("segment_filter");

        builder.Property(e => e.EventId)
            .HasColumnName("event_id");

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(e => e.ScheduledAt)
            .HasColumnName("scheduled_at");

        builder.Property(e => e.SentAt)
            .HasColumnName("sent_at");

        builder.Property(e => e.CompletedAt)
            .HasColumnName("completed_at");

        builder.Property(e => e.TotalRecipients)
            .HasColumnName("total_recipients")
            .HasDefaultValue(0);

        builder.Property(e => e.SentCount)
            .HasColumnName("sent_count")
            .HasDefaultValue(0);

        builder.Property(e => e.DeliveredCount)
            .HasColumnName("delivered_count")
            .HasDefaultValue(0);

        builder.Property(e => e.OpenedCount)
            .HasColumnName("opened_count")
            .HasDefaultValue(0);

        builder.Property(e => e.ClickedCount)
            .HasColumnName("clicked_count")
            .HasDefaultValue(0);

        builder.Property(e => e.BouncedCount)
            .HasColumnName("bounced_count")
            .HasDefaultValue(0);

        builder.Property(e => e.FailedCount)
            .HasColumnName("failed_count")
            .HasDefaultValue(0);

        builder.Property(e => e.CreatedById)
            .HasColumnName("created_by_id")
            .IsRequired();

        builder.Property(e => e.CreatedByName)
            .HasColumnName("created_by_name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at");

        // Navigation to recipients
        builder.HasMany(e => e.Recipients)
            .WithOne()
            .HasForeignKey(r => r.CampaignId)
            .OnDelete(DeleteBehavior.Cascade);

        // Ignore inherited DomainEvents (from Entity base class)
        builder.Ignore(e => e.DomainEvents);

        // Indexes
        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.ScheduledAt);
        builder.HasIndex(e => e.CreatedById);
    }
}
