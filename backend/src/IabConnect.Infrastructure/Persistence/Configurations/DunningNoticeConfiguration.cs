using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-042: EF Core configuration for DunningNotice entity
/// </summary>
public sealed class DunningNoticeConfiguration : IEntityTypeConfiguration<DunningNotice>
{
    public void Configure(EntityTypeBuilder<DunningNotice> builder)
    {
        builder.ToTable("dunning_notices");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(d => d.InvoiceId)
            .HasColumnName("invoice_id")
            .IsRequired();

        builder.HasOne(d => d.Invoice)
            .WithMany()
            .HasForeignKey(d => d.InvoiceId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(d => d.Level)
            .HasColumnName("level")
            .IsRequired();

        builder.Property(d => d.Date)
            .HasColumnName("date")
            .IsRequired();

        builder.Property(d => d.DueDate)
            .HasColumnName("due_date")
            .IsRequired();

        builder.Property(d => d.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(d => d.SentAt)
            .HasColumnName("sent_at");

        builder.Property(d => d.Notes)
            .HasColumnName("notes");

        builder.Property(d => d.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(d => d.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(d => d.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(d => d.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        builder.HasQueryFilter(d => !d.IsDeleted);

        builder.HasIndex(d => d.IsDeleted)
            .HasDatabaseName("ix_dunning_notices_is_deleted");

        builder.Ignore(d => d.DomainEvents);
    }
}
