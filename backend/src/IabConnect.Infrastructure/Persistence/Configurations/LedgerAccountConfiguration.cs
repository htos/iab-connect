using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-075: EF Core configuration for LedgerAccount entity (Chart of Accounts)
/// </summary>
public sealed class LedgerAccountConfiguration : IEntityTypeConfiguration<LedgerAccount>
{
    public void Configure(EntityTypeBuilder<LedgerAccount> builder)
    {
        builder.ToTable("ledger_accounts");

        builder.HasKey(la => la.Id);

        builder.Property(la => la.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(la => la.Number)
            .HasColumnName("number")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(la => la.Name)
            .HasColumnName("name")
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(la => la.AccountClass)
            .HasColumnName("account_class")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(la => la.NormalBalance)
            .HasColumnName("normal_balance")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(la => la.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(la => la.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(la => la.ParentAccountId)
            .HasColumnName("parent_account_id");

        builder.Property(la => la.FinanceProfileId)
            .HasColumnName("finance_profile_id")
            .IsRequired();

        builder.Property(la => la.SortOrder)
            .HasColumnName("sort_order");

        builder.Property(la => la.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(la => la.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(la => la.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(la => la.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Property(la => la.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(la => la.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(la => la.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        // Indexes
        builder.HasIndex(la => new { la.FinanceProfileId, la.Number })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_ledger_accounts_profile_number_unique");

        builder.HasIndex(la => la.FinanceProfileId)
            .HasDatabaseName("ix_ledger_accounts_finance_profile_id");

        builder.HasIndex(la => la.AccountClass)
            .HasDatabaseName("ix_ledger_accounts_account_class");

        // Soft delete global filter
        builder.HasQueryFilter(la => !la.IsDeleted);

        // Self-referencing parent
        builder.HasOne(la => la.ParentAccount)
            .WithMany()
            .HasForeignKey(la => la.ParentAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(la => la.FinanceProfile)
            .WithMany()
            .HasForeignKey(la => la.FinanceProfileId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
