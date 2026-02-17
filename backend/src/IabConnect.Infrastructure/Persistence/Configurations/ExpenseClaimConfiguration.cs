using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-067: EF Core configuration for ExpenseClaim entity
/// </summary>
public sealed class ExpenseClaimConfiguration : IEntityTypeConfiguration<ExpenseClaim>
{
    public void Configure(EntityTypeBuilder<ExpenseClaim> builder)
    {
        builder.ToTable("expense_claims");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Title)
            .HasColumnName("title")
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(e => e.Description)
            .HasColumnName("description")
            .HasMaxLength(2000)
            .IsRequired();

        builder.Property(e => e.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(e => e.Currency)
            .HasColumnName("currency")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(e => e.Date)
            .HasColumnName("date")
            .IsRequired();

        builder.Property(e => e.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        // Claimant
        builder.Property(e => e.ClaimantId)
            .HasColumnName("claimant_id")
            .IsRequired();

        builder.Property(e => e.ClaimantName)
            .HasColumnName("claimant_name")
            .HasMaxLength(300)
            .IsRequired();

        // Receipt FK
        builder.Property(e => e.ReceiptId)
            .HasColumnName("receipt_id");

        builder.HasOne(e => e.Receipt)
            .WithMany()
            .HasForeignKey(e => e.ReceiptId)
            .OnDelete(DeleteBehavior.SetNull);

        // Review
        builder.Property(e => e.ReviewedBy)
            .HasColumnName("reviewed_by")
            .HasMaxLength(200);

        builder.Property(e => e.ReviewedAt)
            .HasColumnName("reviewed_at");

        builder.Property(e => e.ReviewComment)
            .HasColumnName("review_comment")
            .HasMaxLength(1000);

        // Approval
        builder.Property(e => e.ApprovedBy)
            .HasColumnName("approved_by")
            .HasMaxLength(200);

        builder.Property(e => e.ApprovedAt)
            .HasColumnName("approved_at");

        builder.Property(e => e.ApprovalComment)
            .HasColumnName("approval_comment")
            .HasMaxLength(1000);

        // Rejection
        builder.Property(e => e.RejectedBy)
            .HasColumnName("rejected_by")
            .HasMaxLength(200);

        builder.Property(e => e.RejectedAt)
            .HasColumnName("rejected_at");

        builder.Property(e => e.RejectionReason)
            .HasColumnName("rejection_reason")
            .HasMaxLength(1000);

        // Payment FK (reimbursement)
        builder.Property(e => e.PaymentId)
            .HasColumnName("payment_id");

        builder.HasOne(e => e.Payment)
            .WithMany()
            .HasForeignKey(e => e.PaymentId)
            .OnDelete(DeleteBehavior.SetNull);

        builder.Property(e => e.ReimbursedAt)
            .HasColumnName("reimbursed_at");

        builder.Property(e => e.ReimbursedBy)
            .HasColumnName("reimbursed_by")
            .HasMaxLength(200);

        // Tracking
        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(e => e.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(e => e.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(e => e.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Property(e => e.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(e => e.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(e => e.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        builder.HasQueryFilter(e => !e.IsDeleted);

        builder.HasIndex(e => e.IsDeleted)
            .HasDatabaseName("ix_expense_claims_is_deleted");

        builder.HasIndex(e => e.Status)
            .HasDatabaseName("ix_expense_claims_status");

        builder.HasIndex(e => e.ClaimantId)
            .HasDatabaseName("ix_expense_claims_claimant_id");

        builder.Ignore(e => e.DomainEvents);
    }
}
