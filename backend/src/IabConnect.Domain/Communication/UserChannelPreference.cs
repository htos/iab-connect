using IabConnect.Domain.Common;

namespace IabConnect.Domain.Communication;

/// <summary>
/// REQ-030 (E5-S5): a user's preferred communication channel, keyed by the Keycloak <see cref="UserId"/>
/// (the same key <c>Consent</c> uses, so non-member accounts are handled uniformly). One row per user
/// (DEC-1: a single preferred channel). Consent ("may I contact you about X") and channel preference
/// ("by which medium") are orthogonal — both are checked at send time by the eligibility service.
///
/// <para>The channel is stored as its <b>string</b> name (e.g. "Email") rather than the
/// <c>MessageChannel</c> enum, because that enum lives in the Application layer and Domain must not
/// depend on Application. The eligibility service + API map between the string and the enum.</para>
/// </summary>
public sealed class UserChannelPreference : Entity
{
    public Guid UserId { get; private set; }

    /// <summary>The preferred channel's name (matches a <c>MessageChannel</c> enum member). Defaults to "Email".</summary>
    public string PreferredChannel { get; private set; } = DefaultChannel;

    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }

    public const string DefaultChannel = "Email";

    private UserChannelPreference() { } // EF Core

    public static UserChannelPreference Create(Guid userId, string preferredChannel)
    {
        if (userId == Guid.Empty)
            throw new ArgumentException("UserId is required", nameof(userId));
        if (string.IsNullOrWhiteSpace(preferredChannel))
            throw new ArgumentException("Preferred channel is required", nameof(preferredChannel));

        return new UserChannelPreference
        {
            UserId = userId,
            PreferredChannel = preferredChannel,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void SetPreferredChannel(string preferredChannel)
    {
        if (string.IsNullOrWhiteSpace(preferredChannel))
            throw new ArgumentException("Preferred channel is required", nameof(preferredChannel));
        PreferredChannel = preferredChannel;
        UpdatedAt = DateTime.UtcNow;
    }
}

/// <summary>REQ-030 (E5-S5): self-scoped persistence for <see cref="UserChannelPreference"/>.</summary>
public interface IUserChannelPreferenceRepository
{
    Task<UserChannelPreference?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default);

    /// <summary>Insert or update the single preference row for a user.</summary>
    Task UpsertAsync(UserChannelPreference preference, CancellationToken cancellationToken = default);
}
