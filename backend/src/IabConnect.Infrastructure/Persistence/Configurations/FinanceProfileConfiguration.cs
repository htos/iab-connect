using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-060: EF Core configuration for FinanceProfile entity
/// </summary>
public sealed class FinanceProfileConfiguration : IEntityTypeConfiguration<FinanceProfile>
{
    public void Configure(EntityTypeBuilder<FinanceProfile> builder)
    {
        builder.ToTable("finance_profiles");

        builder.HasKey(fp => fp.Id);

        builder.Property(fp => fp.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(fp => fp.Jurisdiction)
            .HasColumnName("jurisdiction")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(fp => fp.CountryCode)
            .HasColumnName("country_code")
            .HasMaxLength(2);

        builder.Property(fp => fp.Currency)
            .HasColumnName("currency")
            .HasConversion<string>()
            .HasMaxLength(10)
            .IsRequired();

        builder.Property(fp => fp.FiscalYearStartMonth)
            .HasColumnName("fiscal_year_start_month")
            .IsRequired();

        builder.Property(fp => fp.OrganizationName)
            .HasColumnName("organization_name")
            .HasMaxLength(300)
            .IsRequired();

        builder.Property(fp => fp.OrganizationAddress)
            .HasColumnName("organization_address")
            .HasMaxLength(500)
            .IsRequired();

        builder.Property(fp => fp.OrganizationCity)
            .HasColumnName("organization_city")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(fp => fp.OrganizationPostalCode)
            .HasColumnName("organization_postal_code")
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(fp => fp.OrganizationCountry)
            .HasColumnName("organization_country")
            .HasMaxLength(2)
            .IsRequired();

        builder.Property(fp => fp.OrganizationEmail)
            .HasColumnName("organization_email")
            .HasMaxLength(300);

        builder.Property(fp => fp.OrganizationPhone)
            .HasColumnName("organization_phone")
            .HasMaxLength(50);

        builder.Property(fp => fp.OrganizationWebsite)
            .HasColumnName("organization_website")
            .HasMaxLength(500);

        builder.Property(fp => fp.OrganizationUid)
            .HasColumnName("organization_uid")
            .HasMaxLength(50);

        // REQ-062: VAT registration
        builder.Property(fp => fp.VatStatus)
            .HasColumnName("vat_status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .HasDefaultValue(VatStatus.NotRegistered);

        builder.Property(fp => fp.VatNumber)
            .HasColumnName("vat_number")
            .HasMaxLength(50);

        builder.Property(fp => fp.BankName)
            .HasColumnName("bank_name")
            .HasMaxLength(300);

        builder.Property(fp => fp.BankIban)
            .HasColumnName("bank_iban")
            .HasMaxLength(34);

        builder.Property(fp => fp.BankBic)
            .HasColumnName("bank_bic")
            .HasMaxLength(11);

        // REQ-067: Payment approval thresholds
        builder.Property(fp => fp.ApprovalThresholdChf)
            .HasColumnName("approval_threshold_chf")
            .HasPrecision(18, 2);

        builder.Property(fp => fp.ApprovalThresholdEur)
            .HasColumnName("approval_threshold_eur")
            .HasPrecision(18, 2);

        builder.Property(fp => fp.IsActive)
            .HasColumnName("is_active");

        // Filtered unique index: only one active profile at a time
        builder.HasIndex(fp => fp.IsActive)
            .IsUnique()
            .HasFilter("is_active = true")
            .HasDatabaseName("ix_finance_profiles_is_active_unique");

        builder.Property(fp => fp.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(fp => fp.UpdatedAt)
            .HasColumnName("updated_at");
    }
}
