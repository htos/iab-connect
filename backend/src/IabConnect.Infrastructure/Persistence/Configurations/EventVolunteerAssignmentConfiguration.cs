using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-024 (E3.S3): EF configuration for <see cref="EventVolunteerAssignment"/>.
/// </summary>
public sealed class EventVolunteerAssignmentConfiguration : IEntityTypeConfiguration<EventVolunteerAssignment>
{
    public void Configure(EntityTypeBuilder<EventVolunteerAssignment> builder)
    {
        builder.ToTable("event_volunteer_assignments");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(a => a.ShiftId).HasColumnName("shift_id").IsRequired();
        builder.Property(a => a.RoleId).HasColumnName("role_id").IsRequired();
        builder.Property(a => a.MemberId).HasColumnName("member_id").IsRequired();
        builder.Property(a => a.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();
        builder.Property(a => a.Position).HasColumnName("position");
        builder.Property(a => a.AssignedAt).HasColumnName("assigned_at").IsRequired();
        builder.Property(a => a.AssignedBy).HasColumnName("assigned_by").IsRequired();
        builder.Property(a => a.CancelledAt).HasColumnName("cancelled_at");
        builder.Property(a => a.ReminderSentAt).HasColumnName("reminder_sent_at");
        builder.Property(a => a.CancellationReason)
            .HasColumnName("cancellation_reason")
            .HasMaxLength(EventVolunteerAssignment.CancellationReasonMaxLength);

        builder.HasOne<EventVolunteerShift>()
            .WithMany()
            .HasForeignKey(a => a.ShiftId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne<EventVolunteerRole>()
            .WithMany()
            .HasForeignKey(a => a.RoleId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(a => a.MemberId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasIndex(a => a.ShiftId).HasDatabaseName("ix_event_volunteer_assignments_shift_id");
        builder.HasIndex(a => a.MemberId).HasDatabaseName("ix_event_volunteer_assignments_member_id");
        builder.HasIndex(a => new { a.ShiftId, a.Status }).HasDatabaseName("ix_event_volunteer_assignments_shift_status");

        // Partial unique index — Postgres filter on status <> 'Cancelled'. Prevents double-signup
        // for the same (shift, member) pair. Database-level last-resort race guard for AC-6.
        builder.HasIndex(a => new { a.ShiftId, a.MemberId })
            .IsUnique()
            .HasFilter("status <> 'Cancelled'")
            .HasDatabaseName("ix_event_volunteer_assignments_shift_member_active");

        builder.Ignore(a => a.DomainEvents);
    }
}
