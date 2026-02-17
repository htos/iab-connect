using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-041: EF Core configuration for BankImportItem entity
/// </summary>
public sealed class BankImportItemConfiguration : IEntityTypeConfiguration<BankImportItem>
{
    public void Configure(EntityTypeBuilder<BankImportItem> builder)
    {
        builder.ToTable("bank_import_items");

        builder.HasKey(bi => bi.Id);

        builder.Property(bi => bi.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(bi => bi.BankImportId)
            .HasColumnName("bank_import_id")
            .IsRequired();

        builder.Property(bi => bi.TransactionDate)
            .HasColumnName("transaction_date")
            .IsRequired();

        builder.Property(bi => bi.Description)
            .HasColumnName("description")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(bi => bi.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2)
            .IsRequired();

        builder.Property(bi => bi.Iban)
            .HasColumnName("iban")
            .HasMaxLength(34);

        builder.Property(bi => bi.Reference)
            .HasColumnName("reference")
            .HasMaxLength(200);

        builder.Property(bi => bi.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(bi => bi.MatchedPaymentId)
            .HasColumnName("matched_payment_id");

        // REQ-069: ISO 20022 reference fields
        builder.Property(bi => bi.EndToEndId)
            .HasColumnName("end_to_end_id")
            .HasMaxLength(200);

        builder.Property(bi => bi.CreditorReference)
            .HasColumnName("creditor_reference")
            .HasMaxLength(200);

        builder.Property(bi => bi.RemittanceInfo)
            .HasColumnName("remittance_info")
            .HasMaxLength(1000);

        builder.Property(bi => bi.DebtorName)
            .HasColumnName("debtor_name")
            .HasMaxLength(200);

        builder.Property(bi => bi.DebtorIban)
            .HasColumnName("debtor_iban")
            .HasMaxLength(34);

        builder.Property(bi => bi.SuggestedInvoiceId)
            .HasColumnName("suggested_invoice_id");

        builder.Property(bi => bi.MatchConfidence)
            .HasColumnName("match_confidence")
            .HasPrecision(5, 4);

        builder.Ignore(bi => bi.DomainEvents);
    }
}
