using IabConnect.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-057: EF Core configuration for RetentionPolicy entity.
/// </summary>
public class RetentionPolicyConfiguration : IEntityTypeConfiguration<RetentionPolicy>
{
    public void Configure(EntityTypeBuilder<RetentionPolicy> builder)
    {
        builder.ToTable("retention_policies");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.DataCategory).HasMaxLength(100).IsRequired();
        builder.HasIndex(e => e.DataCategory).IsUnique();
        builder.Property(e => e.DisplayName).HasMaxLength(200).IsRequired();
        builder.Property(e => e.RetentionMonths).IsRequired();
        builder.Property(e => e.Action).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.LegalBasis).HasMaxLength(500);
        builder.Property(e => e.IsActive).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.UpdatedAt);
    }
}
