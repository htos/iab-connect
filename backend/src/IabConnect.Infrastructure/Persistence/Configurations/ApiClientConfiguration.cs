using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-058 (E8-S1): EF Core configuration for <see cref="ApiClient"/>. The granted scope set is
/// stored as a single comma-joined column (DEC-2 — closed string set, no child table needed). The
/// non-secret <c>secret_prefix</c> is uniquely indexed because it is the auth hot-path lookup key.
/// </summary>
public sealed class ApiClientConfiguration : IEntityTypeConfiguration<ApiClient>
{
    public void Configure(EntityTypeBuilder<ApiClient> builder)
    {
        builder.ToTable("api_clients");

        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id)
            .HasColumnName("id")
            .ValueGeneratedNever();

        builder.Property(e => e.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.Property(e => e.SecretPrefix)
            .HasColumnName("secret_prefix")
            .HasMaxLength(64)
            .IsRequired();

        builder.Property(e => e.SecretHash)
            .HasColumnName("secret_hash")
            .HasMaxLength(128)
            .IsRequired();

        // Granted scopes → a single comma-joined column. ValueComparer so EF detects set changes
        // (the property is replaced wholesale, never mutated in place).
        var scopesConverter = new ValueConverter<IReadOnlyCollection<string>, string>(
            v => string.Join(',', v),
            v => v.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList());
        var scopesComparer = new ValueComparer<IReadOnlyCollection<string>>(
            (a, b) => (a ?? new List<string>()).SequenceEqual(b ?? new List<string>()),
            v => v.Aggregate(0, (hash, s) => HashCode.Combine(hash, s.GetHashCode())),
            v => v.ToList());

        builder.Property(e => e.Scopes)
            .HasColumnName("scopes")
            .HasMaxLength(500)
            .HasConversion(scopesConverter, scopesComparer)
            .IsRequired();

        builder.Property(e => e.IsRevoked)
            .HasColumnName("is_revoked")
            .IsRequired();

        builder.Property(e => e.RevokedAt)
            .HasColumnName("revoked_at");

        builder.Property(e => e.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(e => e.LastUsedAt)
            .HasColumnName("last_used_at");

        // Ignore inherited DomainEvents (from Entity base class)
        builder.Ignore(e => e.DomainEvents);

        builder.HasIndex(e => e.SecretPrefix).IsUnique();
        builder.HasIndex(e => e.CreatedAt);
    }
}
