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

        builder.Ignore(bi => bi.DomainEvents);
    }
}
