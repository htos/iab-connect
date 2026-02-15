using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-039: EF Core configuration for InvoiceItem entity
/// REQ-062: Added VAT/tax columns
/// </summary>
public sealed class InvoiceItemConfiguration : IEntityTypeConfiguration<InvoiceItem>
{
    public void Configure(EntityTypeBuilder<InvoiceItem> builder)
    {
        builder.ToTable("invoice_items");

        builder.HasKey(ii => ii.Id);

        builder.Property(ii => ii.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(ii => ii.InvoiceId)
            .HasColumnName("invoice_id")
            .IsRequired();

        builder.Property(ii => ii.Description)
            .HasColumnName("description")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(ii => ii.Quantity)
            .HasColumnName("quantity")
            .HasPrecision(18, 4);

        builder.Property(ii => ii.UnitPrice)
            .HasColumnName("unit_price")
            .HasPrecision(18, 2);

        builder.Property(ii => ii.Amount)
            .HasColumnName("amount")
            .HasPrecision(18, 2);

        // REQ-062: Tax fields
        builder.Property(ii => ii.TaxCodeId)
            .HasColumnName("tax_code_id");

        builder.Property(ii => ii.TaxRate)
            .HasColumnName("tax_rate")
            .HasPrecision(18, 6);

        builder.Property(ii => ii.TaxAmount)
            .HasColumnName("tax_amount")
            .HasPrecision(18, 2);

        builder.Property(ii => ii.NetAmount)
            .HasColumnName("net_amount")
            .HasPrecision(18, 2);

        builder.Property(ii => ii.GrossAmount)
            .HasColumnName("gross_amount")
            .HasPrecision(18, 2);

        builder.Property(ii => ii.IsGrossEntry)
            .HasColumnName("is_gross_entry")
            .HasDefaultValue(false);

        builder.Ignore(ii => ii.DomainEvents);
    }
}
