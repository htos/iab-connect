using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-071: EF Core configuration for InvoiceNumberCounter entity.
/// Unique constraint on (FinanceProfileId, FiscalYear) ensures one counter per profile/year.
/// </summary>
public sealed class InvoiceNumberCounterConfiguration : IEntityTypeConfiguration<InvoiceNumberCounter>
{
    public void Configure(EntityTypeBuilder<InvoiceNumberCounter> builder)
    {
        builder.ToTable("invoice_number_counters");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(c => c.FinanceProfileId)
            .HasColumnName("finance_profile_id")
            .IsRequired();

        builder.Property(c => c.FiscalYear)
            .HasColumnName("fiscal_year")
            .IsRequired();

        builder.Property(c => c.Prefix)
            .HasColumnName("prefix")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(c => c.CurrentValue)
            .HasColumnName("current_value")
            .IsRequired();

        builder.Property(c => c.UpdatedAt)
            .HasColumnName("updated_at")
            .IsRequired();

        // Unique constraint: one counter per profile + fiscal year
        builder.HasIndex(c => new { c.FinanceProfileId, c.FiscalYear })
            .IsUnique()
            .HasDatabaseName("ix_invoice_number_counters_profile_year");

        builder.HasOne<FinanceProfile>()
            .WithMany()
            .HasForeignKey(c => c.FinanceProfileId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Ignore(c => c.DomainEvents);
    }
}
