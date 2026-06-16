using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>REQ-030 (E5-S5): EF config for <see cref="UserChannelPreference"/> — one row per user (unique UserId).</summary>
public sealed class UserChannelPreferenceConfiguration : IEntityTypeConfiguration<UserChannelPreference>
{
    public void Configure(EntityTypeBuilder<UserChannelPreference> builder)
    {
        builder.ToTable("user_channel_preferences");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.Id).HasColumnName("id").ValueGeneratedNever();
        builder.Property(e => e.UserId).HasColumnName("user_id").IsRequired();
        builder.Property(e => e.PreferredChannel)
            .HasColumnName("preferred_channel").HasMaxLength(50).IsRequired();
        builder.Property(e => e.CreatedAt).HasColumnName("created_at").IsRequired();
        builder.Property(e => e.UpdatedAt).HasColumnName("updated_at");

        builder.Ignore(e => e.DomainEvents);

        // Self-scoped + one preference per user.
        builder.HasIndex(e => e.UserId).IsUnique();
    }
}
