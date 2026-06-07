using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-044 (E6-S1): EF Core configuration for the Budget entity.
/// One active budget per (ActivityArea, FiscalPeriod) pair, enforced by a filtered unique index.
/// </summary>
public sealed class BudgetConfiguration : IEntityTypeConfiguration<Budget>
{
    public void Configure(EntityTypeBuilder<Budget> builder)
    {
        builder.ToTable("budgets");

        builder.HasKey(b => b.Id);

        builder.Property(b => b.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(b => b.ActivityAreaId)
            .HasColumnName("activity_area_id")
            .IsRequired();

        builder.Property(b => b.FiscalPeriodId)
            .HasColumnName("fiscal_period_id")
            .IsRequired();

        builder.Property(b => b.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(b => b.Currency)
            .HasColumnName("currency")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(b => b.Notes)
            .HasColumnName("notes")
            .HasMaxLength(500);

        builder.Property(b => b.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(b => b.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(b => b.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(b => b.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Property(b => b.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(b => b.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(b => b.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        // FK to ActivityArea (the cost center) — never cascade-delete budgets.
        builder.HasOne<ActivityArea>()
            .WithMany()
            .HasForeignKey(b => b.ActivityAreaId)
            .OnDelete(DeleteBehavior.Restrict);

        // FK to FiscalPeriod — never cascade-delete budgets.
        builder.HasOne<FiscalPeriod>()
            .WithMany()
            .HasForeignKey(b => b.FiscalPeriodId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasQueryFilter(b => !b.IsDeleted);

        // Only one active (non-deleted) budget per (area, period) pair.
        builder.HasIndex(b => new { b.ActivityAreaId, b.FiscalPeriodId })
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_budgets_activity_area_fiscal_period_unique");

        builder.Ignore(b => b.DomainEvents);
    }
}
