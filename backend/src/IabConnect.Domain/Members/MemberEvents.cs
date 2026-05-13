using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// Event raised when a new member is created
/// </summary>
public sealed record MemberCreatedEvent(Guid MemberId, string Email) : DomainEvent;

/// <summary>
/// Event raised when a member is activated
/// </summary>
public sealed record MemberActivatedEvent(Guid MemberId) : DomainEvent;

/// <summary>
/// Event raised when a member is deactivated
/// </summary>
public sealed record MemberDeactivatedEvent(Guid MemberId) : DomainEvent;

/// <summary>
/// Event raised when a member is suspended
/// </summary>
public sealed record MemberSuspendedEvent(Guid MemberId) : DomainEvent;

/// <summary>
/// Event raised when membership type changes
/// </summary>
public sealed record MembershipTypeChangedEvent(
    Guid MemberId,
    MembershipType OldType,
    MembershipType NewType) : DomainEvent;

/// <summary>
/// REQ-018 (E2.S3): event raised when a member is merged into another member.
/// Source side: this is the retired record. Target is the surviving record.
/// (<c>OccurredAt</c> is inherited from <see cref="DomainEvent"/>.)
/// </summary>
public sealed record MemberMergedIntoEvent(
    Guid SourceId,
    Guid TargetId,
    Guid AdminUserId) : DomainEvent;
