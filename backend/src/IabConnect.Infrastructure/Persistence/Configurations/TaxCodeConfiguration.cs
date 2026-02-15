using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-062: EF Core configuration for TaxCode entity with seed data
/// </summary>
public sealed class TaxCodeConfiguration : IEntityTypeConfiguration<TaxCode>
{
    public void Configure(EntityTypeBuilder<TaxCode> builder)
    {
        builder.ToTable("tax_codes");

        builder.HasKey(tc => tc.Id);

        builder.Property(tc => tc.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(tc => tc.Code)
            .HasColumnName("code")
            .HasMaxLength(50)
            .IsRequired();

        builder.Property(tc => tc.Label)
            .HasColumnName("label")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(tc => tc.Rate)
            .HasColumnName("rate")
            .HasPrecision(18, 6)
            .IsRequired();

        builder.Property(tc => tc.IsDefault)
            .HasColumnName("is_default")
            .HasDefaultValue(false);

        builder.Property(tc => tc.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true);

        builder.Property(tc => tc.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(tc => tc.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(tc => tc.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(tc => tc.DeletedAt)
            .HasColumnName("deleted_at");

        // Unique code among active, non-deleted tax codes
        builder.HasIndex(tc => tc.Code)
            .IsUnique()
            .HasFilter("is_deleted = false")
            .HasDatabaseName("ix_tax_codes_code_unique_active");

        builder.HasQueryFilter(tc => !tc.IsDeleted);

        builder.Ignore(tc => tc.DomainEvents);

        // Seed default Swiss MWST tax codes
        builder.HasData(
            new
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000001"),
                Code = "MWST_NORMAL",
                Label = "8.1% MWST (Normal)",
                Rate = 0.081m,
                IsDefault = true,
                IsActive = true,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                IsDeleted = false
            },
            new
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000002"),
                Code = "MWST_REDUCED",
                Label = "2.6% MWST (Reduziert)",
                Rate = 0.026m,
                IsDefault = false,
                IsActive = true,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                IsDeleted = false
            },
            new
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000003"),
                Code = "MWST_ACCOMMODATION",
                Label = "3.8% MWST (Beherbergung)",
                Rate = 0.038m,
                IsDefault = false,
                IsActive = true,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                IsDeleted = false
            },
            new
            {
                Id = Guid.Parse("a0000000-0000-0000-0000-000000000004"),
                Code = "MWST_EXEMPT",
                Label = "0% MWST (Befreit)",
                Rate = 0m,
                IsDefault = false,
                IsActive = true,
                CreatedAt = new DateTime(2025, 1, 1, 0, 0, 0, DateTimeKind.Utc),
                IsDeleted = false
            }
        );
    }
}
