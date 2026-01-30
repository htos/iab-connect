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
