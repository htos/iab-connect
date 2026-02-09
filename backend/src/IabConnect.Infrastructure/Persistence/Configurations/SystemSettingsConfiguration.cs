using IabConnect.Domain.Common;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for SystemSettings entity (REQ-059)
/// </summary>
public class SystemSettingsConfiguration : IEntityTypeConfiguration<SystemSettings>
{
    public void Configure(EntityTypeBuilder<SystemSettings> builder)
    {
        builder.ToTable("system_settings");

        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id");

        builder.Property(s => s.ApplicationName)
            .HasColumnName("application_name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(s => s.LogoText)
            .HasColumnName("logo_text")
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(s => s.LogoBackgroundColor)
            .HasColumnName("logo_background_color")
            .HasMaxLength(9)
            .IsRequired();

        builder.Property(s => s.LogoTextColor)
            .HasColumnName("logo_text_color")
            .HasMaxLength(9)
            .IsRequired();

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(s => s.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);
    }
}
