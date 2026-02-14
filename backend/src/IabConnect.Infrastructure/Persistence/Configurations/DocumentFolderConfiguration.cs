using IabConnect.Domain.Documents;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class DocumentFolderConfiguration : IEntityTypeConfiguration<DocumentFolder>
{
    public void Configure(EntityTypeBuilder<DocumentFolder> builder)
    {
        builder.ToTable("document_folders");

        builder.HasKey(f => f.Id);
        builder.Property(f => f.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(f => f.Name)
            .HasColumnName("name")
            .HasMaxLength(255)
            .IsRequired();

        builder.Property(f => f.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(f => f.ParentFolderId)
            .HasColumnName("parent_folder_id");

        builder.Property(f => f.SortOrder)
            .HasColumnName("sort_order")
            .HasDefaultValue(0);

        builder.Property(f => f.CreatedAt).HasColumnName("created_at");
        builder.Property(f => f.CreatedBy).HasColumnName("created_by");
        builder.Property(f => f.UpdatedAt).HasColumnName("updated_at");
        builder.Property(f => f.UpdatedBy).HasColumnName("updated_by");
        builder.Property(f => f.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false);
        builder.Property(f => f.DeletedAt).HasColumnName("deleted_at");
        builder.Property(f => f.DeletedBy).HasColumnName("deleted_by");

        builder.HasOne(f => f.ParentFolder)
            .WithMany(f => f.ChildFolders)
            .HasForeignKey(f => f.ParentFolderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(f => f.Documents)
            .WithOne(d => d.Folder)
            .HasForeignKey(d => d.FolderId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(f => f.Permissions)
            .WithOne()
            .HasForeignKey(p => p.FolderId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(f => f.ParentFolderId)
            .HasDatabaseName("ix_document_folders_parent_folder_id");

        builder.HasIndex(f => f.Name)
            .HasDatabaseName("ix_document_folders_name");

        builder.HasQueryFilter(f => !f.IsDeleted);
    }
}
