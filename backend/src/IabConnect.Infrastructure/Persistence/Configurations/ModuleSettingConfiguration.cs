using IabConnect.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for the <see cref="ModuleSetting"/> entity (REQ-087, Epic E10).
/// Auto-discovered by <c>ApplyConfigurationsFromAssembly</c> — no manual registration.
/// </summary>
public sealed class ModuleSettingConfiguration : IEntityTypeConfiguration<ModuleSetting>
{
    public void Configure(EntityTypeBuilder<ModuleSetting> builder)
    {
        builder.ToTable("module_settings");

        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).HasColumnName("id");

        builder.Property(m => m.ModuleKey)
            .HasColumnName("module_key")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(m => m.Enabled)
            .HasColumnName("enabled")
            .IsRequired();

        builder.Property(m => m.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        builder.Property(m => m.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.HasIndex(m => m.ModuleKey)
            .IsUnique();
    }
}
