using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// Junction entity for M:N relationship between MemberSegment and Member
/// REQ-017: Segmentierung & Verteiler
/// </summary>
public sealed class MemberSegmentAssignment : Entity
{
    public Guid SegmentId { get; private set; }
    public Guid MemberId { get; private set; }
    public DateTime AssignedAt { get; private set; }

    private MemberSegmentAssignment() : base() { }

    public static MemberSegmentAssignment Create(Guid segmentId, Guid memberId)
    {
        return new MemberSegmentAssignment
        {
            SegmentId = segmentId,
            MemberId = memberId,
            AssignedAt = DateTime.UtcNow
        };
    }
}
