using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-040: EF Core configuration for Payment entity
/// </summary>
public sealed class PaymentConfiguration : IEntityTypeConfiguration<Payment>
{
    public void Configure(EntityTypeBuilder<Payment> builder)
    {
        builder.ToTable("payments");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(p => p.Date)
            .HasColumnName("date")
            .IsRequired();

        builder.Property(p => p.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(p => p.Direction)
            .HasColumnName("direction")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.Method)
            .HasColumnName("method")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.Reference)
            .HasColumnName("reference")
            .HasMaxLength(200);

        builder.Property(p => p.InvoiceId)
            .HasColumnName("invoice_id");

        builder.HasOne(p => p.Invoice)
            .WithMany()
            .HasForeignKey(p => p.InvoiceId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(p => p.TransactionId)
            .HasColumnName("transaction_id");

        builder.HasOne(p => p.Transaction)
            .WithMany()
            .HasForeignKey(p => p.TransactionId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(p => p.Notes)
            .HasColumnName("notes");

        // REQ-061: Receipt attachment
        builder.Property(p => p.ReceiptId)
            .HasColumnName("receipt_id");

        builder.HasOne(p => p.Receipt)
            .WithMany()
            .HasForeignKey(p => p.ReceiptId)
            .OnDelete(DeleteBehavior.SetNull);

        // REQ-067: Approval workflow
        builder.Property(p => p.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(p => p.ApprovedBy)
            .HasColumnName("approved_by")
            .HasMaxLength(200);

        builder.Property(p => p.ApprovedAt)
            .HasColumnName("approved_at");

        builder.Property(p => p.ApprovalComment)
            .HasColumnName("approval_comment")
            .HasMaxLength(1000);

        builder.Property(p => p.RejectedBy)
            .HasColumnName("rejected_by")
            .HasMaxLength(200);

        builder.Property(p => p.RejectedAt)
            .HasColumnName("rejected_at");

        builder.Property(p => p.RejectionReason)
            .HasColumnName("rejection_reason")
            .HasMaxLength(1000);

        builder.Property(p => p.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(p => p.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(p => p.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(p => p.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Property(p => p.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(p => p.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(p => p.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        builder.HasQueryFilter(p => !p.IsDeleted);

        builder.HasIndex(p => p.IsDeleted)
            .HasDatabaseName("ix_payments_is_deleted");

        builder.Ignore(p => p.DomainEvents);
    }
}
