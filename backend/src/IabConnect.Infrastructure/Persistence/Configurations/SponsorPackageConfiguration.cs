using IabConnect.Domain.Sponsors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class SponsorPackageConfiguration : IEntityTypeConfiguration<SponsorPackage>
{
    public void Configure(EntityTypeBuilder<SponsorPackage> builder)
    {
        builder.ToTable("sponsor_packages");
        builder.HasKey(p => p.Id);
        builder.Property(p => p.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(p => p.SponsorId)
            .HasColumnName("sponsor_id").IsRequired();

        builder.Property(p => p.Name)
            .HasColumnName("name").HasMaxLength(200).IsRequired();

        builder.Property(p => p.Description)
            .HasColumnName("description").HasMaxLength(2000);

        builder.Property(p => p.Amount)
            .HasColumnName("amount").HasPrecision(18, 2);

        builder.Property(p => p.Currency)
            .HasColumnName("currency").HasMaxLength(3);

        builder.HasIndex(p => p.SponsorId).HasDatabaseName("ix_sponsor_packages_sponsor_id");

        builder.Ignore(p => p.DomainEvents);
    }
}
