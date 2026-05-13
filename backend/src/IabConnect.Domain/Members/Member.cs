using System.Security.Cryptography;
using IabConnect.Domain.Common;

namespace IabConnect.Domain.Members;

/// <summary>
/// Member aggregate root
/// REQ-013, REQ-014, REQ-015, REQ-016
/// </summary>
public sealed class Member : AggregateRoot
{
    public string FirstName { get; private set; } = null!;
    public string LastName { get; private set; } = null!;
    public string Email { get; private set; } = null!;
    public string? Phone { get; private set; }
    public Address Address { get; private set; } = null!;
    public MembershipType MembershipType { get; private set; }
    public MembershipStatus Status { get; private set; }
    public DateOnly MemberSince { get; private set; }
    public Guid? KeycloakUserId { get; private set; }

    /// <summary>
    /// REQ-018 (E2.S3): when non-null, this member has been merged into the target member.
    /// The row is preserved for forensics (audit trail integrity) and is soft-retired:
    /// duplicate-detection / autocomplete queries must filter <c>MergedIntoMemberId == null</c>;
    /// <c>GetByIdAsync</c> intentionally still returns the row.
    /// </summary>
    public Guid? MergedIntoMemberId { get; private set; }

    /// <summary>
    /// REQ-025 (E3.S5 post-review H-S5-1): SHA-256 hex digest of the member's opaque calendar
    /// token. The cleartext token is returned by <see cref="RegenerateCalendarToken"/> exactly
    /// once, given to the calendar client, and then NEVER persisted — a DB read no longer
    /// discloses the active feed credential. Lookup hashes the incoming request token and
    /// compares to this column. Null means the feed is currently revoked.
    /// </summary>
    public string? CalendarSubscriptionTokenHash { get; private set; }

    private Member() : base() { }

    public static Member Create(
        string firstName,
        string lastName,
        string email,
        Address address,
        MembershipType membershipType,
        string? phone = null)
    {
        var member = new Member
        {
            FirstName = firstName,
            LastName = lastName,
            Email = email,
            Phone = phone,
            Address = address,
            MembershipType = membershipType,
            Status = MembershipStatus.Pending,
            MemberSince = DateOnly.FromDateTime(DateTime.UtcNow)
        };

        member.AddDomainEvent(new MemberCreatedEvent(member.Id, email));
        return member;
    }

    public void Update(
        string firstName,
        string lastName,
        string email,
        Address address,
        string? phone = null)
    {
        FirstName = firstName;
        LastName = lastName;
        Email = email;
        Phone = phone;
        Address = address;
    }

    public void Activate()
    {
        if (Status == MembershipStatus.Active)
            return;

        Status = MembershipStatus.Active;
        AddDomainEvent(new MemberActivatedEvent(Id));
    }

    public void Deactivate()
    {
        if (Status == MembershipStatus.Inactive)
            return;

        Status = MembershipStatus.Inactive;
        AddDomainEvent(new MemberDeactivatedEvent(Id));
    }

    public void Suspend()
    {
        if (Status == MembershipStatus.Suspended)
            return;

        Status = MembershipStatus.Suspended;
        AddDomainEvent(new MemberSuspendedEvent(Id));
    }

    public void ChangeMembershipType(MembershipType newType)
    {
        if (MembershipType == newType)
            return;

        var oldType = MembershipType;
        MembershipType = newType;
        AddDomainEvent(new MembershipTypeChangedEvent(Id, oldType, newType));
    }

    public void LinkToKeycloak(Guid keycloakUserId)
    {
        KeycloakUserId = keycloakUserId;
    }

    /// <summary>
    /// REQ-018 (E2.S3): clears the Keycloak link on the source member during a merge.
    /// Used by the merge handler when the source is the one being retired; the target's
    /// own Keycloak link remains untouched and is set via a separate <see cref="LinkToKeycloak"/>
    /// call if a transfer was requested.
    /// </summary>
    public void ClearKeycloakLink()
    {
        KeycloakUserId = null;
    }

    /// <summary>
    /// REQ-018 (E2.S3): mark this member as merged into <paramref name="targetId"/>.
    /// Deactivates the membership (the row stays for forensics) and raises
    /// <see cref="MemberMergedIntoEvent"/>. Idempotent: calling twice keeps the first target.
    /// </summary>
    public void MarkMergedInto(Guid targetId, Guid adminUserId)
    {
        if (targetId == Guid.Empty)
            throw new ArgumentException("Merge target must be a non-empty Guid.", nameof(targetId));
        if (targetId == Id)
            throw new ArgumentException("A member cannot be merged into itself.", nameof(targetId));

        if (MergedIntoMemberId.HasValue)
            return;

        MergedIntoMemberId = targetId;
        Deactivate();
        AddDomainEvent(new MemberMergedIntoEvent(Id, targetId, adminUserId));
    }

    /// <summary>
    /// REQ-025 (E3.S5): Generates a fresh opaque calendar-subscription token (Base64URL of 32
    /// random bytes ≈ 43 chars), assigns it, and returns it. Calling again invalidates the
    /// previous token. Use <see cref="RevokeCalendarToken"/> to drop the feed entirely.
    /// </summary>
    public string RegenerateCalendarToken()
    {
        var bytes = RandomNumberGenerator.GetBytes(32);
        // Base64 URL-safe (no padding) — ASCII-only, fits any URL.
        var token = Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
        // REQ-025 (E3.S5 post-review H-S5-1): persist only the SHA-256 hash. The cleartext
        // token leaves this method via the return value, goes to the calendar client in the
        // subscriptionUrl, and is never written to the database. A DB read therefore cannot
        // disclose any active feed credential; only a successful preimage attack against
        // SHA-256 would, which is computationally infeasible for 32 random bytes of input.
        CalendarSubscriptionTokenHash = HashCalendarToken(token);
        return token;
    }

    /// <summary>
    /// REQ-025 (E3.S5): Clears the calendar-subscription token; subsequent feed fetches return 404.
    /// </summary>
    public void RevokeCalendarToken()
    {
        CalendarSubscriptionTokenHash = null;
    }

    /// <summary>
    /// REQ-025 (E3.S5 post-review H-S5-1): canonical hash function used both at token-rotate
    /// time (stored on the entity) and at request time (computed from the incoming token to
    /// look up the matching member). Lowercase hex of the SHA-256 digest; ASCII-only.
    /// </summary>
    public static string HashCalendarToken(string token)
    {
        ArgumentException.ThrowIfNullOrEmpty(token);
        var bytes = System.Text.Encoding.UTF8.GetBytes(token);
        var digest = System.Security.Cryptography.SHA256.HashData(bytes);
        return Convert.ToHexString(digest).ToLowerInvariant();
    }

    public string FullName => $"{FirstName} {LastName}";
}
