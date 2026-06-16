using IabConnect.Domain.Privacy;

namespace IabConnect.Application.Communication.Messaging;

/// <summary>
/// REQ-030 (E5-S4 seam, E5-S5 implementation): decides which channel a message to a given user
/// should actually use, checking consent + preference + provider-availability (the three-way
/// eligibility gate). S4 defines this seam with a default "email always eligible" implementation
/// (<see cref="DefaultChannelPreferenceService"/>); S5 replaces it with the real eligibility logic
/// + user-stored preferences.
/// </summary>
public interface IChannelPreferenceService
{
    /// <summary>
    /// Resolve the channel to use for (user, requested-channel, consent-type). Returns null when the
    /// recipient should be skipped entirely (e.g. no consent). The default S4 implementation always
    /// returns <see cref="MessageChannel.Email"/>.
    /// </summary>
    Task<MessageChannel?> ResolveChannelAsync(
        Guid? userId,
        MessageChannel requestedChannel,
        ConsentType? consentType,
        CancellationToken cancellationToken = default);
}

/// <summary>
/// REQ-030 (E5-S4, DEC-4): the default seam implementation — email is always eligible. Registered
/// until S5 supplies the real consent+preference+availability eligibility service.
/// </summary>
public sealed class DefaultChannelPreferenceService : IChannelPreferenceService
{
    public Task<MessageChannel?> ResolveChannelAsync(
        Guid? userId,
        MessageChannel requestedChannel,
        ConsentType? consentType,
        CancellationToken cancellationToken = default)
        => Task.FromResult<MessageChannel?>(MessageChannel.Email);
}
