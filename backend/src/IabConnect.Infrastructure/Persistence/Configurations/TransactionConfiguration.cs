using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-038: EF Core configuration for Transaction entity
/// </summary>
public sealed class TransactionConfiguration : IEntityTypeConfiguration<Transaction>
{
    public void Configure(EntityTypeBuilder<Transaction> builder)
    {
        builder.ToTable("transactions");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(t => t.Date)
            .HasColumnName("date")
            .IsRequired();

        builder.Property(t => t.Description)
            .HasColumnName("description")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(t => t.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(t => t.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(t => t.AccountId)
            .HasColumnName("account_id")
            .IsRequired();

        builder.HasOne(t => t.Account)
            .WithMany()
            .HasForeignKey(t => t.AccountId)
            .IsRequired()
            .OnDelete(DeleteBehavior.Restrict);

        builder.Property(t => t.CategoryId)
            .HasColumnName("category_id");

        builder.HasOne(t => t.Category)
            .WithMany()
            .HasForeignKey(t => t.CategoryId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(t => t.Reference)
            .HasColumnName("reference")
            .HasMaxLength(200);

        builder.Property(t => t.Notes)
            .HasColumnName("notes");

        // REQ-062: Tax fields
        builder.Property(t => t.TaxCodeId)
            .HasColumnName("tax_code_id");

        builder.Property(t => t.TaxRate)
            .HasColumnName("tax_rate")
            .HasPrecision(18, 6);

        builder.Property(t => t.TaxAmount)
            .HasColumnName("tax_amount")
            .HasPrecision(18, 2);

        builder.Property(t => t.NetAmount)
            .HasColumnName("net_amount")
            .HasPrecision(18, 2);

        builder.Property(t => t.ReceiptId)
            .HasColumnName("receipt_id");

        builder.HasOne(t => t.Receipt)
            .WithMany()
            .HasForeignKey(t => t.ReceiptId)
            .OnDelete(DeleteBehavior.SetNull);

        // REQ-068: Activity area
        builder.Property(t => t.ActivityAreaId)
            .HasColumnName("activity_area_id");

        builder.HasOne(t => t.ActivityArea)
            .WithMany()
            .HasForeignKey(t => t.ActivityAreaId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(t => t.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(t => t.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(t => t.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Property(t => t.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(t => t.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(t => t.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        // REQ-070: Archive fields
        builder.Property(t => t.IsArchived)
            .HasColumnName("is_archived")
            .HasDefaultValue(false);

        builder.Property(t => t.ArchivedAt)
            .HasColumnName("archived_at");

        builder.Property(t => t.ArchivedBy)
            .HasColumnName("archived_by")
            .HasMaxLength(200);

        builder.Property(t => t.ArchiveReason)
            .HasColumnName("archive_reason")
            .HasMaxLength(1000);

        builder.Property(t => t.RetainUntil)
            .HasColumnName("retain_until");

        builder.HasQueryFilter(t => !t.IsDeleted);

        builder.HasIndex(t => t.IsDeleted)
            .HasDatabaseName("ix_transactions_is_deleted");

        builder.HasIndex(t => t.IsArchived)
            .HasDatabaseName("ix_transactions_is_archived");

        builder.Ignore(t => t.DomainEvents);
    }
}
