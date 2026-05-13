using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-024 (E3.S3): EF configuration for <see cref="EventVolunteerShift"/>.
/// </summary>
public sealed class EventVolunteerShiftConfiguration : IEntityTypeConfiguration<EventVolunteerShift>
{
    public void Configure(EntityTypeBuilder<EventVolunteerShift> builder)
    {
        builder.ToTable("event_volunteer_shifts");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(s => s.EventId).HasColumnName("event_id").IsRequired();
        builder.Property(s => s.RoleId).HasColumnName("role_id").IsRequired();
        builder.Property(s => s.Title).HasColumnName("title").HasMaxLength(EventVolunteerShift.TitleMaxLength).IsRequired();
        builder.Property(s => s.Description).HasColumnName("description").HasMaxLength(EventVolunteerShift.DescriptionMaxLength);
        builder.Property(s => s.StartsAt).HasColumnName("starts_at").IsRequired();
        builder.Property(s => s.EndsAt).HasColumnName("ends_at").IsRequired();
        builder.Property(s => s.Capacity).HasColumnName("capacity").IsRequired();
        builder.Property(s => s.AllowWaitlist).HasColumnName("allow_waitlist").HasDefaultValue(false).IsRequired();
        builder.Property(s => s.AllowSelfSignup).HasColumnName("allow_self_signup").HasDefaultValue(false).IsRequired();
        builder.Property(s => s.Notes).HasColumnName("notes").HasMaxLength(EventVolunteerShift.NotesMaxLength);
        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at");

        // REQ-024 (E3.S3, post-review H-S3-6): cancellation state — added by the
        // AddVolunteerShiftCancellationState migration. HasConversion<string>() persists the
        // enum as a varchar to mirror the EventVolunteerAssignment.Status configuration and
        // remain stable across enum-value-renames at the storage layer.
        builder.Property(s => s.Status)
            .HasColumnName("status")
            .HasMaxLength(50)
            .HasConversion<string>()
            .HasDefaultValue(VolunteerShiftStatus.Active)
            .IsRequired();
        builder.Property(s => s.CancelledAt).HasColumnName("cancelled_at");
        builder.Property(s => s.CancellationReason)
            .HasColumnName("cancellation_reason")
            .HasMaxLength(EventVolunteerShift.CancellationReasonMaxLength);

        builder.HasOne<Event>()
            .WithMany()
            .HasForeignKey(s => s.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<EventVolunteerRole>()
            .WithMany()
            .HasForeignKey(s => s.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(s => s.EventId).HasDatabaseName("ix_event_volunteer_shifts_event_id");
        builder.HasIndex(s => new { s.RoleId, s.StartsAt }).HasDatabaseName("ix_event_volunteer_shifts_role_starts_at");

        builder.ToTable(t => t.HasCheckConstraint(
            "ck_event_volunteer_shifts_capacity_min",
            "capacity >= 1"));

        builder.Ignore(s => s.DomainEvents);
    }
}
