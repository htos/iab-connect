using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-043: EF Core configuration for Receipt entity
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

        builder.Property(r => r.UploadedAt)
            .HasColumnName("uploaded_at");

        builder.Property(r => r.UploadedBy)
            .HasColumnName("uploaded_by")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(r => r.Notes)
            .HasColumnName("notes");

        builder.Ignore(r => r.DomainEvents);
    }
}
