using IabConnect.Domain.Members;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace IabConnect.Infrastructure.Persistence.Configurations;

/// <summary>
/// EF Core configuration for MemberSegment entity
/// REQ-017: Segmentierung & Verteiler
/// </summary>
public sealed class MemberSegmentConfiguration : IEntityTypeConfiguration<MemberSegment>
{
    public void Configure(EntityTypeBuilder<MemberSegment> builder)
    {
        builder.ToTable("member_segments");

        builder.HasKey(s => s.Id);

        builder.Property(s => s.Id)
            .HasColumnName("id");

        builder.Property(s => s.Name)
            .HasColumnName("name")
            .HasMaxLength(200)
            .IsRequired();

        builder.HasIndex(s => s.Name)
            .IsUnique()
            .HasDatabaseName("ix_member_segments_name");

        builder.Property(s => s.Description)
            .HasColumnName("description")
            .HasMaxLength(1000);

        builder.Property(s => s.SegmentType)
            .HasColumnName("segment_type")
            .HasConversion<string>()
            .HasMaxLength(20)
            .IsRequired();

        builder.Property(s => s.CriteriaJson)
            .HasColumnName("criteria_json")
            .HasColumnType("jsonb");

        builder.Property(s => s.Color)
            .HasColumnName("color")
            .HasMaxLength(20);

        builder.Property(s => s.IsActive)
            .HasColumnName("is_active")
            .HasDefaultValue(true)
            .IsRequired();

        // Audit fields
        builder.Property(s => s.CreatedAt)
            .HasColumnName("created_at")
            .IsRequired();

        builder.Property(s => s.CreatedBy)
            .HasColumnName("created_by");

        builder.Property(s => s.UpdatedAt)
            .HasColumnName("updated_at");

        builder.Property(s => s.UpdatedBy)
            .HasColumnName("updated_by");

        builder.Property(s => s.IsDeleted)
            .HasColumnName("is_deleted")
            .HasDefaultValue(false)
            .IsRequired();

        builder.Property(s => s.DeletedAt)
            .HasColumnName("deleted_at");

        builder.Property(s => s.DeletedBy)
            .HasColumnName("deleted_by");

        // Soft delete filter
        builder.HasQueryFilter(s => !s.IsDeleted);

        // Assignments navigation – use backing field so EF change-tracking
        // detects additions/removals on the private List<> directly.
        builder.HasMany(s => s.Assignments)
            .WithOne()
            .HasForeignKey(a => a.SegmentId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.Navigation(s => s.Assignments)
            .UsePropertyAccessMode(PropertyAccessMode.Field);

        // Ignore domain events
        builder.Ignore(s => s.DomainEvents);
    }
}

/// <summary>
/// EF Core configuration for MemberSegmentAssignment entity
/// </summary>
public sealed class MemberSegmentAssignmentConfiguration : IEntityTypeConfiguration<MemberSegmentAssignment>
{
    public void Configure(EntityTypeBuilder<MemberSegmentAssignment> builder)
    {
        builder.ToTable("member_segment_assignments");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Id)
            .HasColumnName("id");

        builder.Property(a => a.SegmentId)
            .HasColumnName("segment_id")
            .IsRequired();

        builder.Property(a => a.MemberId)
            .HasColumnName("member_id")
            .IsRequired();

        builder.Property(a => a.AssignedAt)
            .HasColumnName("assigned_at")
            .IsRequired();

        // Unique constraint: a member can only be in a segment once
        builder.HasIndex(a => new { a.SegmentId, a.MemberId })
            .IsUnique()
            .HasDatabaseName("ix_member_segment_assignments_segment_member");

        // FK to Member
        builder.HasOne<Member>()
            .WithMany()
            .HasForeignKey(a => a.MemberId)
            .OnDelete(DeleteBehavior.Cascade);

        // Ignore domain events
        builder.Ignore(a => a.DomainEvents);
    }
}
