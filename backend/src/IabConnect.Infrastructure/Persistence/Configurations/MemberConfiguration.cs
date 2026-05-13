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

        // REQ-018 (E2.S3): soft-retire pointer set during member merge.
        builder.Property(m => m.MergedIntoMemberId)
            .HasColumnName("merged_into_member_id");

        builder.HasIndex(m => m.MergedIntoMemberId)
            .HasDatabaseName("ix_members_merged_into_member_id")
            .HasFilter("merged_into_member_id IS NOT NULL");

        // REQ-025 (E3.S5 post-review H-S5-1): the column now stores the SHA-256 hex digest of
        // the calendar token (64 lowercase hex chars), NOT the cleartext token. The column name
        // is kept as `calendar_subscription_token` to avoid a destructive rename; semantics are
        // documented here and on the entity property. Partial unique index unchanged — collision
        // probability on SHA-256 hex is negligible, so uniqueness still holds.
        builder.Property(m => m.CalendarSubscriptionTokenHash)
            .HasColumnName("calendar_subscription_token")
            .HasMaxLength(64);

        builder.HasIndex(m => m.CalendarSubscriptionTokenHash)
            .IsUnique()
            .HasDatabaseName("ix_members_calendar_subscription_token")
            .HasFilter("calendar_subscription_token IS NOT NULL");

        // REQ-018 review patch: changed from DeleteBehavior.SetNull to Restrict so a hard-delete of
        // the merge target does NOT silently null out the source's MergedIntoMemberId pointer (which
        // would resurrect the merged source row in GetAllNonMergedAsync and the duplicates UI).
        // Target hard-deletes must explicitly handle dependent merged-source rows first.
        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(m => m.MergedIntoMemberId)
            .OnDelete(DeleteBehavior.Restrict);

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
