using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for Member entity
/// </summary>
public sealed class MemberConfiguration : IEntityTypeConfiguration<Member>
{
    public void Configure(EntityTypeBuilder<Member> builder)
    {
        builder.ToTable("members");

        builder.HasKey(m => m.Id);
        
        builder.Property(m => m.Id)
            .HasColumnName("id");

        builder.Property(m => m.FirstName)
            .HasColumnName("first_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(m => m.LastName)
            .HasColumnName("last_name")
            .HasMaxLength(100)
            .IsRequired();

        builder.Property(m => m.Email)
            .HasColumnName("email")
            .HasMaxLength(255)
            .IsRequired();

        builder.HasIndex(m => m.Email)
            .IsUnique()
            .HasDatabaseName("ix_members_email");

        builder.Property(m => m.Phone)
            .HasColumnName("phone")
            .HasMaxLength(30);

        builder.Property(m => m.MembershipType)
            .HasColumnName("membership_type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.Status)
            .HasColumnName("status")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(m => m.MemberSince)
            .HasColumnName("member_since")
            .IsRequired();

        builder.Property(m => m.KeycloakUserId)
            .HasColumnName("keycloak_user_id");

        builder.HasIndex(m => m.KeycloakUserId)
            .IsUnique()
            .HasDatabaseName("ix_members_keycloak_user_id")
            .HasFilter("keycloak_user_id IS NOT NULL");

        // Address as owned entity
        builder.OwnsOne(m => m.Address, addressBuilder =>
        {
            addressBuilder.Property(a => a.Street)
                .HasColumnName("address_street")
                .HasMaxLength(200)
                .IsRequired();

            addressBuilder.Property(a => a.City)
                .HasColumnName("address_city")
                .HasMaxLength(100)
                .IsRequired();

            addressBuilder.Property(a => a.PostalCode)
                .HasColumnName("address_postal_code")
                .HasMaxLength(20)
                .IsRequired();

            addressBuilder.Property(a => a.Country)
                .HasColumnName("address_country")
                .HasMaxLength(100)
                .IsRequired();
        });

        // Audit fields
        builder.Property(m => m.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(m => m.CreatedBy)
            .HasColumnName("created_by");

        builder.Property(m => m.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(m => m.UpdatedBy)
            .HasColumnName("updated_by");

        builder.Property(m => m.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(m => m.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(m => m.DeletedBy)
            .HasColumnName("deleted_by");

        // Soft delete filter
        builder.HasQueryFilter(m => !m.IsDeleted);

        // Ignore domain events (not persisted)
        builder.Ignore(m => m.DomainEvents);
    }
}
