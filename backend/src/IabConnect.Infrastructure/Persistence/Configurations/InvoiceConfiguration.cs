using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-039: EF Core configuration for Invoice entity
/// </summary>
public sealed class InvoiceConfiguration : IEntityTypeConfiguration<Invoice>
{
    public void Configure(EntityTypeBuilder<Invoice> builder)
    {
        builder.ToTable("invoices");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(i => i.InvoiceNumber)
            .HasColumnName("invoice_number")
            .HasMaxLength(50)
            .IsRequired();

        builder.HasIndex(i => i.InvoiceNumber)
            .IsUnique()
            .HasDatabaseName("ix_invoices_invoice_number");

        builder.Property(i => i.Date)
            .HasColumnName("date")
            .IsRequired();

        builder.Property(i => i.DueDate)
            .HasColumnName("due_date")
            .IsRequired();

        builder.Property(i => i.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(i => i.RecipientType)
            .HasColumnName("recipient_type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(i => i.RecipientId)
            .HasColumnName("recipient_id");

        builder.Property(i => i.RecipientName)
            .HasColumnName("recipient_name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(i => i.RecipientAddress)
            .HasColumnName("recipient_address")
            .HasMaxLength(500);

        builder.Property(i => i.SubTotal)
            .HasColumnName("sub_total")
            .HasPrecision(18, 2);

        builder.Property(i => i.TaxRate)
            .HasColumnName("tax_rate")
            .HasPrecision(18, 2);

        builder.Property(i => i.TaxAmount)
            .HasColumnName("tax_amount")
            .HasPrecision(18, 2);

        builder.Property(i => i.Total)
            .HasColumnName("total")
            .HasPrecision(18, 2);

        builder.Property(i => i.Notes)
            .HasColumnName("notes");

        builder.HasMany(i => i.Items)
            .WithOne()
            .HasForeignKey(item => item.InvoiceId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(i => i.Items)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.Property(i => i.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(i => i.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(i => i.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(i => i.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Ignore(i => i.DomainEvents);
    }
}
