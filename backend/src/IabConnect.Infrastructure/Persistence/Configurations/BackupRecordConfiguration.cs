using IabConnect.Domain.Operations;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-053: EF Core configuration for BackupRecord entity.
/// </summary>
public class BackupRecordConfiguration : IEntityTypeConfiguration<BackupRecord>
{
    public void Configure(EntityTypeBuilder<BackupRecord> builder)
    {
        builder.ToTable("backup_records");
        builder.HasKey(e => e.Id);
        builder.Property(e => e.FileName).HasMaxLength(255).IsRequired();
        builder.Property(e => e.FileSizeBytes).IsRequired();
        builder.Property(e => e.Type).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Status).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.Notes).HasMaxLength(1000);
        builder.Property(e => e.CreatedBy).HasMaxLength(200).IsRequired();
        builder.Property(e => e.CreatedAt).IsRequired();
        builder.Property(e => e.CompletedAt);
        builder.Property(e => e.ErrorMessage).HasMaxLength(2000);
    }
}
