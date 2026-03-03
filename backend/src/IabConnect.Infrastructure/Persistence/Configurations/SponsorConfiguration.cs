using IabConnect.Domain.Sponsors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class SponsorConfiguration : IEntityTypeConfiguration<Sponsor>
{
    public void Configure(EntityTypeBuilder<Sponsor> builder)
    {
        builder.ToTable("sponsors");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(s => s.CompanyName)
            .HasColumnName("company_name").HasMaxLength(200).IsRequired();

        builder.Property(s => s.ContactPerson)
            .HasColumnName("contact_person").HasMaxLength(200);

        builder.Property(s => s.Email)
            .HasColumnName("email").HasMaxLength(200);

        builder.Property(s => s.Phone)
            .HasColumnName("phone").HasMaxLength(50);

        builder.Property(s => s.Website)
            .HasColumnName("website").HasMaxLength(500);

        builder.Property(s => s.Street)
            .HasColumnName("street").HasMaxLength(200);

        builder.Property(s => s.City)
            .HasColumnName("city").HasMaxLength(100);

        builder.Property(s => s.PostalCode)
            .HasColumnName("postal_code").HasMaxLength(20);

        builder.Property(s => s.Country)
            .HasColumnName("country").HasMaxLength(100);

        builder.Property(s => s.Status)
            .HasColumnName("status").HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(s => s.Tier)
            .HasColumnName("tier").HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(s => s.Notes)
            .HasColumnName("notes").HasMaxLength(2000);

        builder.Property(s => s.AgreementStart)
            .HasColumnName("agreement_start");

        builder.Property(s => s.AgreementEnd)
            .HasColumnName("agreement_end");

        builder.Property(s => s.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(s => s.CreatedBy).HasColumnName("created_by");
        builder.Property(s => s.UpdatedAt).HasColumnName("updated_at");
        builder.Property(s => s.UpdatedBy).HasColumnName("updated_by");
        builder.Property(s => s.IsDeleted).HasColumnName("is_deleted").HasDefaultValue(false).IsRequired();
        builder.Property(s => s.DeletedAt).HasColumnName("deleted_at");
        builder.Property(s => s.DeletedBy).HasColumnName("deleted_by");

        builder.HasMany(s => s.Packages)
            .WithOne()
            .HasForeignKey(p => p.SponsorId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.Packages).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(s => s.ContractLinks)
            .WithOne()
            .HasForeignKey(cl => cl.SponsorId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(s => s.ContractLinks).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasIndex(s => s.CompanyName).HasDatabaseName("ix_sponsors_company_name");
        builder.HasIndex(s => s.Status).HasDatabaseName("ix_sponsors_status");
        builder.HasIndex(s => s.IsDeleted).HasDatabaseName("ix_sponsors_is_deleted");

        builder.HasQueryFilter(s => !s.IsDeleted);
        builder.Ignore(s => s.DomainEvents);
    }
}
