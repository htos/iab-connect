using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// Member segment aggregate root
/// REQ-017: Segmentierung & Verteiler
/// </summary>
public sealed class MemberSegment : AggregateRoot
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public SegmentType SegmentType { get; private set; }
    public string? CriteriaJson { get; private set; }
    public string? Color { get; private set; }
    public bool IsActive { get; private set; }

    private readonly List<MemberSegmentAssignment> _assignments = [];
    public IReadOnlyList<MemberSegmentAssignment> Assignments => _assignments.AsReadOnly();

    private MemberSegment() : base() { }

    public static MemberSegment Create(
        string name,
        SegmentType segmentType,
        string? description = null,
        string? criteriaJson = null,
        string? color = null)
    {
        var segment = new MemberSegment
        {
            Name = name,
            Description = description,
            SegmentType = segmentType,
            CriteriaJson = criteriaJson,
            Color = color,
            IsActive = true
        };

        segment.AddDomainEvent(new MemberSegmentCreatedEvent(segment.Id, name, segmentType));
        return segment;
    }

    public void Update(
        string name,
        string? description,
        string? criteriaJson,
        string? color)
    {
        Name = name;
        Description = description;
        CriteriaJson = criteriaJson;
        Color = color;
    }

    public void Activate()
    {
        IsActive = true;
    }

    public void Deactivate()
    {
        IsActive = false;
    }

    public void AddMember(Guid memberId)
    {
        if (SegmentType != SegmentType.Static)
            throw new InvalidOperationException("Members can only be manually assigned to static segments");

        if (_assignments.Any(a => a.MemberId == memberId))
            return;

        _assignments.Add(MemberSegmentAssignment.Create(Id, memberId));
    }

    public void RemoveMember(Guid memberId)
    {
        if (SegmentType != SegmentType.Static)
            throw new InvalidOperationException("Members can only be manually removed from static segments");

        var assignment = _assignments.FirstOrDefault(a => a.MemberId == memberId);
        if (assignment != null)
            _assignments.Remove(assignment);
    }
}

/// <summary>
/// Segment type enumeration
/// </summary>
public enum SegmentType
{
    /// <summary>Members are manually assigned</summary>
    Static = 0,

    /// <summary>Members are determined by filter criteria</summary>
    Dynamic = 1
}
