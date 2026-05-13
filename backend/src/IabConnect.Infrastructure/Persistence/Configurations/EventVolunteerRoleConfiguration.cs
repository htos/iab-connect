using IabConnect.Domain.Events;
using IabConnect.Domain.Events.Volunteers;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-024 (E3.S3): EF configuration for <see cref="EventVolunteerRole"/>.
/// </summary>
public sealed class EventVolunteerRoleConfiguration : IEntityTypeConfiguration<EventVolunteerRole>
{
    public void Configure(EntityTypeBuilder<EventVolunteerRole> builder)
    {
        builder.ToTable("event_volunteer_roles");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(r => r.EventId).HasColumnName("event_id").IsRequired();
        builder.Property(r => r.Name).HasColumnName("name").HasMaxLength(EventVolunteerRole.NameMaxLength).IsRequired();
        builder.Property(r => r.Description).HasColumnName("description").HasMaxLength(EventVolunteerRole.DescriptionMaxLength);
        builder.Property(r => r.IsActive).HasColumnName("is_active").HasDefaultValue(true).IsRequired();
        builder.Property(r => r.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(r => r.CreatedBy).HasColumnName("created_by").IsRequired();
        builder.Property(r => r.UpdatedAt).HasColumnName("updated_at");

        builder.HasOne<Event>()
            .WithMany()
            .HasForeignKey(r => r.EventId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(r => r.EventId).HasDatabaseName("ix_event_volunteer_roles_event_id");

        // Case-insensitive unique-per-event role name. EF Core doesn't natively express
        // lower(name) in HasIndex; we attach the index here and rewrite the migration
        // SQL to include the lower() expression. (See migration body.)
        builder.HasIndex(r => new { r.EventId, r.Name })
            .IsUnique()
            .HasDatabaseName("ix_event_volunteer_roles_event_name_lower");

        builder.Ignore(r => r.DomainEvents);
    }
}
