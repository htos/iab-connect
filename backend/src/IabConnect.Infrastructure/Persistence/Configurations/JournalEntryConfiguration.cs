using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-076: EF Core configuration for JournalEntry entity
/// </summary>
public sealed class JournalEntryConfiguration : IEntityTypeConfiguration<JournalEntry>
{
    public void Configure(EntityTypeBuilder<JournalEntry> builder)
    {
        builder.ToTable("journal_entries");

        builder.HasKey(je => je.Id);

        builder.Property(je => je.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(je => je.Date)
            .HasColumnName("date")
            .IsRequired();

        builder.Property(je => je.Description)
            .HasColumnName("description")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(je => je.Reference)
            .HasColumnName("reference")
            .HasMaxLength(100);

        builder.Property(je => je.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(je => je.SourceType)
            .HasColumnName("source_type")
            .HasMaxLength(50);

        builder.Property(je => je.SourceId)
            .HasColumnName("source_id");

        builder.Property(je => je.FiscalPeriodId)
            .HasColumnName("fiscal_period_id");

        builder.Property(je => je.FinanceProfileId)
            .HasColumnName("finance_profile_id")
            .IsRequired();

        builder.Property(je => je.ReversalOfEntryId)
            .HasColumnName("reversal_of_entry_id");

        builder.Property(je => je.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(je => je.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(je => je.PostedAt)
            .HasColumnName("posted_at");

        builder.Property(je => je.PostedBy)
            .HasColumnName("posted_by")
            .HasMaxLength(200);

        // Indexes
        builder.HasIndex(je => je.Date)
            .HasDatabaseName("ix_journal_entries_date");

        builder.HasIndex(je => je.Status)
            .HasDatabaseName("ix_journal_entries_status");

        builder.HasIndex(je => new { je.SourceType, je.SourceId })
            .HasDatabaseName("ix_journal_entries_source");

        builder.HasIndex(je => je.FinanceProfileId)
            .HasDatabaseName("ix_journal_entries_finance_profile_id");

        builder.HasIndex(je => je.FiscalPeriodId)
            .HasDatabaseName("ix_journal_entries_fiscal_period_id");

        // Relationships
        builder.HasOne(je => je.ReversalOfEntry)
            .WithMany()
            .HasForeignKey(je => je.ReversalOfEntryId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(je => je.FiscalPeriod)
            .WithMany()
            .HasForeignKey(je => je.FiscalPeriodId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(je => je.FinanceProfile)
            .WithMany()
            .HasForeignKey(je => je.FinanceProfileId)
            .OnDelete(DeleteBehavior.Restrict);

        // Lines collection
        builder.HasMany(je => je.Lines)
            .WithOne(l => l.JournalEntry)
            .HasForeignKey(l => l.JournalEntryId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(je => je.Lines)
            .UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}

/// <summary>
/// REQ-076: EF Core configuration for JournalEntryLine entity
/// </summary>
public sealed class JournalEntryLineConfiguration : IEntityTypeConfiguration<JournalEntryLine>
{
    public void Configure(EntityTypeBuilder<JournalEntryLine> builder)
    {
        builder.ToTable("journal_entry_lines");

        builder.HasKey(jl => jl.Id);

        builder.Property(jl => jl.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(jl => jl.JournalEntryId)
            .HasColumnName("journal_entry_id")
            .IsRequired();

        builder.Property(jl => jl.LedgerAccountId)
            .HasColumnName("ledger_account_id")
            .IsRequired();

        builder.Property(jl => jl.DebitAmount)
            .HasColumnName("debit_amount")
            .HasPrecision(18, 2);

        builder.Property(jl => jl.CreditAmount)
            .HasColumnName("credit_amount")
            .HasPrecision(18, 2);

        builder.Property(jl => jl.TaxCodeId)
            .HasColumnName("tax_code_id");

        builder.Property(jl => jl.NetAmount)
            .HasColumnName("net_amount")
            .HasPrecision(18, 2);

        builder.Property(jl => jl.TaxAmount)
            .HasColumnName("tax_amount")
            .HasPrecision(18, 2);

        builder.Property(jl => jl.ActivityAreaId)
            .HasColumnName("activity_area_id");

        // Indexes
        builder.HasIndex(jl => jl.JournalEntryId)
            .HasDatabaseName("ix_journal_entry_lines_journal_entry_id");

        builder.HasIndex(jl => jl.LedgerAccountId)
            .HasDatabaseName("ix_journal_entry_lines_ledger_account_id");

        // Relationships
        builder.HasOne(jl => jl.LedgerAccount)
            .WithMany()
            .HasForeignKey(jl => jl.LedgerAccountId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(jl => jl.TaxCode)
            .WithMany()
            .HasForeignKey(jl => jl.TaxCodeId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(jl => jl.ActivityArea)
            .WithMany()
            .HasForeignKey(jl => jl.ActivityAreaId)
            .OnDelete(DeleteBehavior.Restrict);
    }
}
