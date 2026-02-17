using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-064: EF Core configuration for InvoiceTemplate entity
/// </summary>
public sealed class InvoiceTemplateConfiguration : IEntityTypeConfiguration<InvoiceTemplate>
{
    public void Configure(EntityTypeBuilder<InvoiceTemplate> builder)
    {
        builder.ToTable("invoice_templates");

        builder.HasKey(t => t.Id);

        builder.Property(t => t.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(t => t.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(t => t.Jurisdiction)
            .HasColumnName("jurisdiction")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(t => t.CountryCode)
            .HasColumnName("country_code")
            .HasMaxLength(2);

        builder.Property(t => t.IsDefault)
            .HasColumnName("is_default");

        builder.Property(t => t.ShowVatId)
            .HasColumnName("show_vat_id")
            .HasDefaultValue(true);

        builder.Property(t => t.ShowTaxExemptionNote)
            .HasColumnName("show_tax_exemption_note");

        builder.Property(t => t.TaxExemptionNote)
            .HasColumnName("tax_exemption_note")
            .HasMaxLength(500);

        builder.Property(t => t.ShowReverseChargeNote)
            .HasColumnName("show_reverse_charge_note");

        builder.Property(t => t.ReverseChargeNote)
            .HasColumnName("reverse_charge_note")
            .HasMaxLength(500);

        builder.Property(t => t.ShowPaymentTerms)
            .HasColumnName("show_payment_terms")
            .HasDefaultValue(true);

        builder.Property(t => t.DefaultPaymentTerms)
            .HasColumnName("default_payment_terms")
            .HasMaxLength(500);

        builder.Property(t => t.ShowBankDetails)
            .HasColumnName("show_bank_details")
            .HasDefaultValue(true);

        builder.Property(t => t.LogoUrl)
            .HasColumnName("logo_url")
            .HasMaxLength(500);

        builder.Property(t => t.HeaderText)
            .HasColumnName("header_text")
            .HasMaxLength(1000);

        builder.Property(t => t.FooterText)
            .HasColumnName("footer_text")
            .HasMaxLength(1000);

        builder.Property(t => t.LegalNotice)
            .HasColumnName("legal_notice")
            .HasMaxLength(1000);

        builder.Property(t => t.Language)
            .HasColumnName("language")
            .HasMaxLength(5)
            .HasDefaultValue("en")
            .IsRequired();

        builder.Property(t => t.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(t => t.UpdatedAt)
            .HasColumnName("updated_at");

        // Unique index: only one default template per jurisdiction + country_code
        builder.HasIndex(t => new { t.Jurisdiction, t.CountryCode, t.IsDefault })
            .IsUnique()
            .HasFilter("is_default = true")
            .HasDatabaseName("ix_invoice_templates_jurisdiction_country_default");

        builder.Ignore(t => t.DomainEvents);
    }
}
