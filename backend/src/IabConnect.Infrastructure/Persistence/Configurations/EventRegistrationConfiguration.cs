using IabConnect.Domain.Events;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-020: EF Core configuration for EventRegistration entity
/// </summary>
public sealed class EventRegistrationConfiguration : IEntityTypeConfiguration<EventRegistration>
{
    public void Configure(EntityTypeBuilder<EventRegistration> builder)
    {
        builder.ToTable("event_registrations");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.EventId)
            .HasColumnName("event_id")
            .IsRequired();

        builder.Property(e => e.UserId)
            .HasColumnName("user_id");

        builder.Property(e => e.MemberId)
            .HasColumnName("member_id");

        builder.Property(e => e.ParticipantName)
            .HasColumnName("participant_name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.ParticipantEmail)
            .HasColumnName("participant_email")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(e => e.ParticipantPhone)
            .HasColumnName("participant_phone")
            .HasMaxLength(50);

        builder.Property(e => e.NumberOfGuests)
            .HasColumnName("number_of_guests")
            .HasDefaultValue(1)
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.IsWaitlisted)
            .HasColumnName("is_waitlisted")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(e => e.WaitlistPosition)
            .HasColumnName("waitlist_position");

        builder.Property(e => e.RegisteredAt)
            .HasColumnName("registered_at")
            .IsRequired();

        builder.Property(e => e.ConfirmedAt)
            .HasColumnName("confirmed_at");

        builder.Property(e => e.CancelledAt)
            .HasColumnName("cancelled_at");

        builder.Property(e => e.CancellationReason)
            .HasColumnName("cancellation_reason")
            .HasMaxLength(500);

        builder.Property(e => e.CancelledByParticipant)
            .HasColumnName("cancelled_by_participant")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(e => e.CheckedInAt)
            .HasColumnName("checked_in_at");

        builder.Property(e => e.CheckedInBy)
            .HasColumnName("checked_in_by");

        builder.Property(e => e.IsNoShow)
            .HasColumnName("is_no_show")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(e => e.Notes)
            .HasColumnName("notes")
            .HasMaxLength(1000);

        builder.Property(e => e.SpecialRequirements)
            .HasColumnName("special_requirements")
            .HasMaxLength(500);

        builder.Property(e => e.QrCodeToken)
            .HasColumnName("qr_code_token")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at");

        // Indexes
        builder.HasIndex(e => e.EventId)
            .HasDatabaseName("ix_event_registrations_event_id");

        builder.HasIndex(e => e.UserId)
            .HasDatabaseName("ix_event_registrations_user_id");

        builder.HasIndex(e => e.MemberId)
            .HasDatabaseName("ix_event_registrations_member_id");

        builder.HasIndex(e => e.ParticipantEmail)
            .HasDatabaseName("ix_event_registrations_participant_email");

        builder.HasIndex(e => e.QrCodeToken)
            .IsUnique()
            .HasDatabaseName("ix_event_registrations_qr_code_token");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("ix_event_registrations_status");

        // Composite index for checking existing registration
        builder.HasIndex(e => new { e.EventId, e.UserId })
            .HasDatabaseName("ix_event_registrations_event_user");

        builder.HasIndex(e => new { e.EventId, e.ParticipantEmail })
            .HasDatabaseName("ix_event_registrations_event_email");

        // Waitlist index
        builder.HasIndex(e => new { e.EventId, e.IsWaitlisted, e.WaitlistPosition })
            .HasDatabaseName("ix_event_registrations_waitlist");

        // Ignore inherited DomainEvents navigation (from Entity base class)
        builder.Ignore(e => e.DomainEvents);
    }
}
