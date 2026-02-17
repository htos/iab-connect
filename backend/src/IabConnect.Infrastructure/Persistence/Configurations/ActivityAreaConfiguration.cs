using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-068: EF Core configuration for ActivityArea entity
/// </summary>
public sealed class ActivityAreaConfiguration : IEntityTypeConfiguration<ActivityArea>
{
    public void Configure(EntityTypeBuilder<ActivityArea> builder)
    {
        builder.ToTable("activity_areas");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(a => a.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(a => a.Code)
            .HasColumnName("code")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(a => a.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(a => a.Color)
            .HasColumnName("color")
            .HasMaxLength(7);

        builder.Property(a => a.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(a => a.SortOrder)
            .HasColumnName("sort_order")
            .HasDefaultValue(0);

        builder.Property(a => a.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(a => a.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(a => a.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(a => a.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(a => a.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        // Unique code among non-deleted activity areas
        builder.HasIndex(a => a.Code)
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_activity_areas_code_unique_active");

        builder.HasQueryFilter(a => !a.IsDeleted);

        builder.Ignore(a => a.DomainEvents);
    }
}
