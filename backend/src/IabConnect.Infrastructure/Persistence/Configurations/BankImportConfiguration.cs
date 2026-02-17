using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-041: EF Core configuration for BankImport entity
/// </summary>
public sealed class BankImportConfiguration : IEntityTypeConfiguration<BankImport>
{
    public void Configure(EntityTypeBuilder<BankImport> builder)
    {
        builder.ToTable("bank_imports");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(b => b.ImportDate)
            .HasColumnName("import_date")
            .IsRequired();

        builder.Property(b => b.FileName)
            .HasColumnName("file_name")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(b => b.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(b => b.ImportedBy)
            .HasColumnName("imported_by")
            .HasMaxLength(200)
            .IsRequired();

        // REQ-069: Import format and original file storage
        builder.Property(b => b.Format)
            .HasColumnName("format")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(BankImportFormat.Csv)
            .IsRequired();

        builder.Property(b => b.OriginalFileStoragePath)
            .HasColumnName("original_file_storage_path")
            .HasMaxLength(1000);

        builder.HasMany(b => b.Items)
            .WithOne()
            .HasForeignKey(item => item.BankImportId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(b => b.Items)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Property(b => b.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(b => b.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(b => b.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        builder.HasQueryFilter(b => !b.IsDeleted);

        builder.HasIndex(b => b.IsDeleted)
            .HasDatabaseName("ix_bank_imports_is_deleted");

        builder.Ignore(b => b.DomainEvents);
    }
}
