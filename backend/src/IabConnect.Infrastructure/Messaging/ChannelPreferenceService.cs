using IabConnect.Application.Communication.Messaging;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;

namespace IabConnect.Infrastructure.Messaging;

/// <summary>
/// REQ-030 (E5-S5): the REAL <see cref="IChannelPreferenceService"/> — replaces S4's
/// email-always-eligible default. Decides which channel to use for (user, requested-channel,
/// consent-type) by checking all three (AC-2): <b>consent</b> (via
/// <see cref="IConsentRepository.HasConsentAsync"/>), <b>preference</b> (the user's stored
/// <see cref="UserChannelPreference"/>), and <b>provider/channel availability</b>
/// (<see cref="IMessageChannelSender.IsEnabled"/>). Degrades gracefully (AC-3): no consent → skip
/// (returns null); preferred channel unavailable → fall back to email if enabled, else skip; no
/// explicit preference → default to email.
/// </summary>
public sealed class ChannelPreferenceService : IChannelPreferenceService
{
    private readonly IUserChannelPreferenceRepository _preferences;
    private readonly IConsentRepository _consents;
    private readonly IReadOnlyList<IMessageChannelSender> _senders;

    public ChannelPreferenceService(
        IUserChannelPreferenceRepository preferences,
        IConsentRepository consents,
        IEnumerable<IMessageChannelSender> senders)
    {
        _preferences = preferences;
        _consents = consents;
        _senders = senders.ToList();
    }

    public async Task<MessageChannel?> ResolveChannelAsync(
        Guid? userId,
        MessageChannel requestedChannel,
        ConsentType? consentType,
        CancellationToken cancellationToken = default)
    {
        // (a) Consent gate — a user who has not consented to the purpose is skipped.
        if (consentType.HasValue && userId.HasValue
            && !await _consents.HasConsentAsync(userId.Value, consentType.Value, cancellationToken))
        {
            return null;
        }

        // (b) Preference — the user's chosen channel (default email when no row / non-member).
        var preferred = MessageChannel.Email;
        if (userId.HasValue)
        {
            var pref = await _preferences.GetByUserIdAsync(userId.Value, cancellationToken);
            if (pref is not null && Enum.TryParse<MessageChannel>(pref.PreferredChannel, out var parsed))
                preferred = parsed;
        }

        // (c) Availability — use the preferred channel if its provider is enabled; else fall back to
        // email if email is enabled+consented; else skip (graceful degradation, never wrong-channel).
        if (IsEnabled(preferred))
            return preferred;

        if (preferred != MessageChannel.Email && IsEnabled(MessageChannel.Email))
            return MessageChannel.Email;

        return null;
    }

    private bool IsEnabled(MessageChannel channel)
        => _senders.Any(s => s.Channel == channel && s.IsEnabled);
}
