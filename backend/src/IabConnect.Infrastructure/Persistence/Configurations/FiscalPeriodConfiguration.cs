using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public class FiscalPeriodConfiguration : IEntityTypeConfiguration<FiscalPeriod>
{
    public void Configure(EntityTypeBuilder<FiscalPeriod> builder)
    {
        builder.ToTable("fiscal_periods");

        builder.HasKey(e => e.Id);
        builder.Property(e => e.Id).ValueGeneratedNever();

        builder.Property(e => e.Name).HasColumnName("name").HasMaxLength(50).IsRequired();
        builder.Property(e => e.Year).HasColumnName("year").IsRequired();
        builder.Property(e => e.Month).HasColumnName("month").IsRequired();
        builder.Property(e => e.StartDate).HasColumnName("start_date").IsRequired();
        builder.Property(e => e.EndDate).HasColumnName("end_date").IsRequired();
        builder.Property(e => e.Status).HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(e => e.LockedAt).HasColumnName("locked_at");
        builder.Property(e => e.LockedBy).HasColumnName("locked_by").HasMaxLength(200);
        builder.Property(e => e.UnlockedAt).HasColumnName("unlocked_at");
        builder.Property(e => e.UnlockedBy).HasColumnName("unlocked_by").HasMaxLength(200);
        builder.Property(e => e.LockNotes).HasColumnName("lock_notes").HasMaxLength(1000);
        builder.Property(e => e.TotalIncome).HasColumnName("total_income").HasPrecision(18, 2);
        builder.Property(e => e.TotalExpense).HasColumnName("total_expense").HasPrecision(18, 2);
        builder.Property(e => e.ClosingBalance).HasColumnName("closing_balance").HasPrecision(18, 2);
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at").IsRequired();

        // Unique constraint: only one period per year+month
        builder.HasIndex(e => new { e.Year, e.Month }).IsUnique();

        builder.Ignore(e => e.DomainEvents);
    }
}
