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

        // REQ-086 (E9-S1): organization profile & branding — all nullable, no IsRequired.
        builder.Property(s => s.Description)
            .HasColumnName("description")
            .HasMaxLength(2000);

        builder.Property(s => s.ContactEmail)
            .HasColumnName("contact_email")
            .HasMaxLength(320);

        builder.Property(s => s.ContactPhone)
            .HasColumnName("contact_phone")
            .HasMaxLength(50);

        builder.Property(s => s.ContactAddress)
            .HasColumnName("contact_address")
            .HasMaxLength(500);

        builder.Property(s => s.PrimaryColor)
            .HasColumnName("primary_color")
            .HasMaxLength(9);

        builder.Property(s => s.PublicSiteEnabled)
            .HasColumnName("public_site_enabled");

        builder.Property(s => s.LogoAssetKey)
            .HasColumnName("logo_asset_key")
            .HasMaxLength(500);

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(s => s.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);
    }
}
