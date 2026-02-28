using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-043 / REQ-061: EF Core configuration for Receipt entity
/// </summary>
public sealed class ReceiptConfiguration : IEntityTypeConfiguration<Receipt>
{
    public void Configure(EntityTypeBuilder<Receipt> builder)
    {
        builder.ToTable("receipts");

        builder.HasKey(r => r.Id);

        builder.Property(r => r.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(r => r.FileName)
            .HasColumnName("file_name")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(r => r.FilePath)
            .HasColumnName("file_path")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(r => r.ContentType)
            .HasColumnName("content_type")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(r => r.FileSize)
            .HasColumnName("file_size")
            .IsRequired();

        builder.Property(r => r.FileHash)
            .HasColumnName("file_hash")
            .HasMaxLength(64);

        builder.Property(r => r.UploadedAt)
            .HasColumnName("uploaded_at");

        builder.Property(r => r.UploadedBy)
            .HasColumnName("uploaded_by")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(r => r.Notes)
            .HasColumnName("notes");

        builder.Property(r => r.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(r => r.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(r => r.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        // REQ-070: Archive fields
        builder.Property(r => r.IsArchived)
            .HasColumnName("is_archived")
            .HasDefaultValue(false);

        builder.Property(r => r.ArchivedAt)
            .HasColumnName("archived_at");

        builder.Property(r => r.ArchivedBy)
            .HasColumnName("archived_by")
            .HasMaxLength(200);

        builder.Property(r => r.ArchiveReason)
            .HasColumnName("archive_reason")
            .HasMaxLength(1000);

        builder.Property(r => r.RetainUntil)
            .HasColumnName("retain_until");

        builder.HasQueryFilter(r => !r.IsDeleted);

        builder.HasIndex(r => r.IsDeleted)
            .HasDatabaseName("ix_receipts_is_deleted");

        builder.HasIndex(r => r.IsArchived)
            .HasDatabaseName("ix_receipts_is_archived");

        builder.Ignore(r => r.DomainEvents);
    }
}
