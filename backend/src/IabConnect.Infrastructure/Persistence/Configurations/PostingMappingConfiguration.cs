using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-077: EF Core configuration for PostingMapping entity
/// </summary>
public sealed class PostingMappingConfiguration : IEntityTypeConfiguration<PostingMapping>
{
    public void Configure(EntityTypeBuilder<PostingMapping> builder)
    {
        builder.ToTable("posting_mappings");

        builder.HasKey(pm => pm.Id);

        builder.Property(pm => pm.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(pm => pm.FinanceProfileId)
            .HasColumnName("finance_profile_id")
            .IsRequired();

        builder.Property(pm => pm.MappingType)
            .HasColumnName("mapping_type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(pm => pm.SourceId)
            .HasColumnName("source_id")
            .IsRequired();

        builder.Property(pm => pm.LedgerAccountId)
            .HasColumnName("ledger_account_id")
            .IsRequired();

        builder.Property(pm => pm.TaxLedgerAccountId)
            .HasColumnName("tax_ledger_account_id");

        builder.Property(pm => pm.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(pm => pm.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(pm => pm.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(pm => pm.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        // Composite unique index: one mapping per source per profile
        builder.HasIndex(pm => new { pm.FinanceProfileId, pm.MappingType, pm.SourceId })
            .IsUnique()
            .HasDatabaseName("ix_posting_mappings_profile_type_source_unique");

        builder.HasIndex(pm => pm.FinanceProfileId)
            .HasDatabaseName("ix_posting_mappings_finance_profile_id");

        // Relationships
        builder.HasOne(pm => pm.FinanceProfile)
            .WithMany()
            .HasForeignKey(pm => pm.FinanceProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(pm => pm.LedgerAccount)
            .WithMany()
            .HasForeignKey(pm => pm.LedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(pm => pm.TaxLedgerAccount)
            .WithMany()
            .HasForeignKey(pm => pm.TaxLedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
