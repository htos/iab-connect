using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-028 (E5-S1): EF Core configuration for <see cref="AutomationDefinition"/>. Mirrors
/// <see cref="EmailCampaignConfiguration"/> (string-converted enums, indexes on Status/CreatedAt/
/// CreatedById). The <see cref="AutomationTrigger"/> is mapped as an owned value (columns on the
/// same table).
/// </summary>
public sealed class AutomationDefinitionConfiguration : IEntityTypeConfiguration<AutomationDefinition>
{
    public void Configure(EntityTypeBuilder<AutomationDefinition> builder)
    {
        builder.ToTable("automation_definitions");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(e => e.TemplateId)
            .HasColumnName("template_id")
            .IsRequired();

        // Owned trigger value → columns on the same table.
        builder.OwnsOne(e => e.Trigger, t =>
        {
            t.Property(p => p.Type)
                .HasColumnName("trigger_type")
                .HasConversion<string>()
                .HasMaxLength(50)
                .IsRequired();

            t.Property(p => p.OffsetDays)
                .HasColumnName("trigger_offset_days");
        });
        builder.Navigation(e => e.Trigger).IsRequired();

        builder.Property(e => e.SegmentType)
            .HasColumnName("segment_type")
            .HasConversion<string>()
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(e => e.SegmentFilter)
            .HasColumnName("segment_filter");

        builder.Property(e => e.ConsentFilter)
            .HasColumnName("consent_filter")
            .HasConversion<string>()
            .HasMaxLength(50);

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

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

        // Ignore inherited DomainEvents (from Entity base class)
        builder.Ignore(e => e.DomainEvents);

        builder.HasIndex(e => e.Status);
        builder.HasIndex(e => e.CreatedAt);
        builder.HasIndex(e => e.CreatedById);
    }
}
