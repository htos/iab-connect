using IabConnect.Domain.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class DocumentVersionConfiguration : IEntityTypeConfiguration<DocumentVersion>
{
    public void Configure(EntityTypeBuilder<DocumentVersion> builder)
    {
        builder.ToTable("document_versions");

        builder.HasKey(v => v.Id);
        builder.Property(v => v.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(v => v.DocumentId)
            .HasColumnName("document_id")
            .IsRequired();

        builder.Property(v => v.VersionNumber)
            .HasColumnName("version_number")
            .IsRequired();

        builder.Property(v => v.StorageKey)
            .HasColumnName("storage_key")
            .HasMaxLength(1000)
            .IsRequired();

        builder.Property(v => v.FileSize)
            .HasColumnName("file_size")
            .IsRequired();

        builder.Property(v => v.ContentType)
            .HasColumnName("content_type")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(v => v.Comment)
            .HasColumnName("comment")
            .HasMaxLength(1000);

        builder.Property(v => v.UploadedAt)
            .HasColumnName("uploaded_at")
            .IsRequired();

        builder.Property(v => v.UploadedBy)
            .HasColumnName("uploaded_by");

        builder.HasIndex(v => new { v.DocumentId, v.VersionNumber })
            .IsUnique()
            .HasDatabaseName("ix_document_versions_document_version");

        builder.HasIndex(v => v.DocumentId)
            .HasDatabaseName("ix_document_versions_document_id");
    }
}
