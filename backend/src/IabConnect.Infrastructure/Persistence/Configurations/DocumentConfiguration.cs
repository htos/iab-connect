using IabConnect.Domain.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class DocumentConfiguration : IEntityTypeConfiguration<Document>
{
    public void Configure(EntityTypeBuilder<Document> builder)
    {
        builder.ToTable("documents");

        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(d => d.Name)
            .HasColumnName("name")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(d => d.Description)
            .HasColumnName("description")
            .HasMaxLength(2000);

        builder.Property(d => d.Category)
            .HasColumnName("category")
            .HasConversion<string>()
            .HasMaxLength(30)
            .IsRequired();

        builder.Property(d => d.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(d => d.FolderId)
            .HasColumnName("folder_id")
            .IsRequired();

        builder.Property(d => d.ContentType)
            .HasColumnName("content_type")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(d => d.FileSize)
            .HasColumnName("file_size")
            .IsRequired();

        builder.Property(d => d.ExpiresAt)
            .HasColumnName("expires_at");

        builder.Property(d => d.ReviewedBy).HasColumnName("reviewed_by");
        builder.Property(d => d.ReviewedAt).HasColumnName("reviewed_at");
        builder.Property(d => d.PublishedBy).HasColumnName("published_by");
        builder.Property(d => d.PublishedAt).HasColumnName("published_at");

        builder.Property(d => d.CreatedAt).HasColumnName("created_at");
        builder.Property(d => d.CreatedBy).HasColumnName("created_by");
        builder.Property(d => d.UpdatedAt).HasColumnName("updated_at");
        builder.Property(d => d.UpdatedBy).HasColumnName("updated_by");
        builder.Property(d => d.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
        builder.Property(d => d.DeletedAt).HasColumnName("deleted_at");
        builder.Property(d => d.DeletedBy).HasColumnName("deleted_by");

        builder.HasOne(d => d.Folder)
            .WithMany(f => f.Documents)
            .HasForeignKey(d => d.FolderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(d => d.Versions)
            .WithOne()
            .HasForeignKey(v => v.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasMany(d => d.Tags)
            .WithOne()
            .HasForeignKey(t => t.DocumentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => d.FolderId).HasDatabaseName("ix_documents_folder_id");
        builder.HasIndex(d => d.Status).HasDatabaseName("ix_documents_status");
        builder.HasIndex(d => d.Category).HasDatabaseName("ix_documents_category");
        builder.HasIndex(d => d.CreatedAt).HasDatabaseName("ix_documents_created_at");
        builder.HasIndex(d => d.Name).HasDatabaseName("ix_documents_name");

        builder.HasQueryFilter(d => !d.IsDeleted);
    }
}
