using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// Event raised when a new member segment is created
/// </summary>
public sealed record MemberSegmentCreatedEvent(Guid SegmentId, string Name, SegmentType SegmentType) : DomainEvent;
