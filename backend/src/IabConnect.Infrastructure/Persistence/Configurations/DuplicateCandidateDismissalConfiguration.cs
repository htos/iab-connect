using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// REQ-018 (E2.S4): EF Core configuration for <see cref="DuplicateCandidateDismissal"/>.
/// </summary>
/// <remarks>
/// Unique index on the canonicalised <c>(source_member_id, target_member_id)</c> pair enforces
/// "one dismissal per unordered pair." Both FKs use <see cref="DeleteBehavior.Restrict"/> — a
/// member that has been dismissed-against MUST be merged or hard-deleted explicitly before the
/// row can be removed; the dismissal does NOT cascade.
/// </remarks>
public sealed class DuplicateCandidateDismissalConfiguration : IEntityTypeConfiguration<DuplicateCandidateDismissal>
{
    public void Configure(EntityTypeBuilder<DuplicateCandidateDismissal> builder)
    {
        builder.ToTable("duplicate_candidate_dismissals");

        builder.HasKey(d => d.Id);

        builder.Property(d => d.Id)
            .HasColumnName("id");

        builder.Property(d => d.SourceMemberId)
            .HasColumnName("source_member_id")
            .IsRequired();

        builder.Property(d => d.TargetMemberId)
            .HasColumnName("target_member_id")
            .IsRequired();

        builder.Property(d => d.DismissedByUserId)
            .HasColumnName("dismissed_by_user_id")
            .IsRequired();

        builder.Property(d => d.DismissedAt)
            .HasColumnName("dismissed_at")
            .IsRequired();

        builder.Property(d => d.Reason)
            .HasColumnName("reason")
            .HasMaxLength(500)
            .IsRequired();

        builder.HasIndex(d => new { d.SourceMemberId, d.TargetMemberId })
            .IsUnique()
            .HasDatabaseName("ix_duplicate_candidate_dismissals_pair");

        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(d => d.SourceMemberId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(d => d.TargetMemberId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.Ignore(d => d.DomainEvents);
    }
}
