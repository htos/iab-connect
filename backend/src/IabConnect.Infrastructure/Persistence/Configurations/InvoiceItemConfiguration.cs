using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-039: EF Core configuration for InvoiceItem entity
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

        builder.Ignore(ii => ii.DomainEvents);
    }
}
