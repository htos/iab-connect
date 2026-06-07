using IabConnect.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-019: EF Core configuration for Event entity
/// </summary>
public sealed class EventConfiguration : IEntityTypeConfiguration<Event>
{
    public void Configure(EntityTypeBuilder<Event> builder)
    {
        builder.ToTable("events");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Title)
            .HasColumnName("title")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("description")
            .IsRequired();

        builder.Property(e => e.ShortDescription)
            .HasColumnName("short_description")
            .HasMaxLength(500);

        builder.Property(e => e.Location)
            .HasColumnName("location")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.LocationAddress)
            .HasColumnName("location_address")
            .HasMaxLength(500);

        builder.Property(e => e.LocationUrl)
            .HasColumnName("location_url")
            .HasMaxLength(500);

        builder.Property(e => e.StartDate)
            .HasColumnName("start_date")
            .IsRequired();

        builder.Property(e => e.EndDate)
            .HasColumnName("end_date")
            .IsRequired();

        builder.Property(e => e.IsAllDay)
            .HasColumnName("is_all_day")
            .HasDefaultValue(false);

        builder.Property(e => e.TimeZone)
            .HasColumnName("time_zone")
            .HasMaxLength(50)
            .HasDefaultValue("Europe/Zurich");

        builder.Property(e => e.IsRecurring)
            .HasColumnName("is_recurring")
            .HasDefaultValue(false);

        builder.Property(e => e.RecurrencePattern)
            .HasColumnName("recurrence_pattern")
            .HasConversion<string>()
            .HasMaxLength(20);

        builder.Property(e => e.ParentEventId)
            .HasColumnName("parent_event_id");

        builder.Property(e => e.MaxParticipants)
            .HasColumnName("max_participants");

        builder.Property(e => e.RegistrationRequired)
            .HasColumnName("registration_required")
            .HasDefaultValue(false);

        builder.Property(e => e.RegistrationDeadline)
            .HasColumnName("registration_deadline");

        builder.Property(e => e.WaitlistEnabled)
            .HasColumnName("waitlist_enabled")
            .HasDefaultValue(false);

        builder.Property(e => e.Visibility)
            .HasColumnName("visibility")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EventVisibility.MembersOnly);

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EventStatus.Draft);

        builder.Property(e => e.Category)
            .HasColumnName("category")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(EventCategory.General);

        builder.Property(e => e.Tags)
            .HasColumnName("tags")
            .HasConversion(
                v => string.Join(',', v),
                v => v.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList()
            );

        builder.Property(e => e.ImageUrl)
            .HasColumnName("image_url")
            .HasMaxLength(500);

        builder.Property(e => e.ImageAltText)
            .HasColumnName("image_alt_text")
            .HasMaxLength(200);

        builder.Property(e => e.OrganizerId)
            .HasColumnName("organizer_id");

        builder.Property(e => e.OrganizerName)
            .HasColumnName("organizer_name")
            .HasMaxLength(200);

        builder.Property(e => e.ContactEmail)
            .HasColumnName("contact_email")
            .HasMaxLength(255);

        builder.Property(e => e.ContactPhone)
            .HasColumnName("contact_phone")
            .HasMaxLength(50);

        builder.Property(e => e.Cost)
            .HasColumnName("cost")
            .HasPrecision(10, 2);

        builder.Property(e => e.CostDescription)
            .HasColumnName("cost_description")
            .HasMaxLength(500);

        // REQ-055 (E7-S4): optional content language (ISO 639-1; null = default)
        builder.Property(e => e.ContentLanguage)
            .HasColumnName("content_language")
            .HasMaxLength(10);

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(e => e.PublishedAt)
            .HasColumnName("published_at");

        builder.Property(e => e.CancelledAt)
            .HasColumnName("cancelled_at");

        builder.Property(e => e.CancellationReason)
            .HasColumnName("cancellation_reason")
            .HasMaxLength(1000);

        builder.Property(e => e.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(e => e.DeletedAt)
            .HasColumnName("deleted_at");

        // Indexes
        builder.HasIndex(e => e.StartDate)
            .HasDatabaseName("ix_events_start_date");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("ix_events_status");

        builder.HasIndex(e => e.Visibility)
            .HasDatabaseName("ix_events_visibility");

        builder.HasIndex(e => e.OrganizerId)
            .HasDatabaseName("ix_events_organizer_id");

        builder.HasIndex(e => new { e.IsDeleted, e.Status, e.StartDate })
            .HasDatabaseName("ix_events_filter");

        // Query filter for soft delete
        builder.HasQueryFilter(e => !e.IsDeleted);

        // Ignore domain events collection from base class
        builder.Ignore(e => e.DomainEvents);
    }
}
