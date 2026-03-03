using IabConnect.Domain.Sponsors;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

public sealed class ContractLinkConfiguration : IEntityTypeConfiguration<ContractLink>
{
    public void Configure(EntityTypeBuilder<ContractLink> builder)
    {
        builder.ToTable("contract_links");
        builder.HasKey(cl => cl.Id);
        builder.Property(cl => cl.Id).HasColumnName("id").ValueGeneratedNever();

        builder.Property(cl => cl.SponsorId)
            .HasColumnName("sponsor_id");

        builder.Property(cl => cl.SupplierId)
            .HasColumnName("supplier_id");

        builder.Property(cl => cl.LinkType)
            .HasColumnName("link_type").HasConversion<string>().HasMaxLength(20).IsRequired();

        builder.Property(cl => cl.TargetId)
            .HasColumnName("target_id").IsRequired();

        builder.Property(cl => cl.Description)
            .HasColumnName("description").HasMaxLength(500);

        builder.Property(cl => cl.CreatedAt)
            .HasColumnName("created_at").IsRequired();

        builder.HasIndex(cl => cl.SponsorId).HasDatabaseName("ix_contract_links_sponsor_id");
        builder.HasIndex(cl => cl.SupplierId).HasDatabaseName("ix_contract_links_supplier_id");
        builder.HasIndex(cl => cl.TargetId).HasDatabaseName("ix_contract_links_target_id");

        builder.Ignore(cl => cl.DomainEvents);
    }
}
