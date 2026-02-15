using IabConnect.Domain.Finance;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-038: EF Core configuration for Account entity
/// </summary>
public sealed class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(a => a.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(a => a.Number)
            .HasColumnName("number")
            .HasMaxLength(50)
            .IsRequired();

        builder.HasIndex(a => a.Number)
            .IsUnique()
            .HasDatabaseName("ix_accounts_number");

        builder.Property(a => a.Type)
            .HasColumnName("type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(a => a.Description)
            .HasColumnName("description")
            .HasMaxLength(500);

        builder.Property(a => a.IsActive)
            .HasColumnName("is_active");

        builder.Property(a => a.SortOrder)
            .HasColumnName("sort_order");

        builder.Property(a => a.CreatedAt)
            .HasColumnName("created_at");

        builder.Property(a => a.CreatedBy)
            .HasColumnName("created_by")
            .HasMaxLength(200);

        builder.Property(a => a.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(a => a.UpdatedBy)
            .HasColumnName("updated_by")
            .HasMaxLength(200);

        builder.Property(a => a.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false);

        builder.Property(a => a.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(a => a.DeletedBy)
            .HasColumnName("deleted_by")
            .HasMaxLength(200);

        builder.HasQueryFilter(a => !a.IsDeleted);

        builder.HasIndex(a => a.IsDeleted)
            .HasDatabaseName("ix_accounts_is_deleted");

        builder.Ignore(a => a.DomainEvents);
    }
}
