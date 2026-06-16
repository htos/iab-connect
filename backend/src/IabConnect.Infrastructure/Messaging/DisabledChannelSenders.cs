using IabConnect.Application.Communication.Messaging;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Messaging;

/// <summary>
/// REQ-030 (E5-S4, AC-3): SMS channel — a disabled stub. <see cref="IsEnabled"/> is driven by
/// config (<c>Sms:Enabled</c>, false by default since no provider is chosen). The dispatcher knows
/// the channel exists but never routes to it while disabled; invoking it directly throws
/// <see cref="ChannelDisabledException"/> (DEC-2). Wiring a real provider = implement the provider
/// adapter here (behind <see cref="IMessageProvider"/>) + flip the config flag — no dispatcher or
/// caller change.
/// </summary>
public sealed class SmsChannelSender : IMessageChannelSender
{
    private readonly SmsSettings _settings;

    public SmsChannelSender(IOptions<SmsSettings> settings)
    {
        _settings = settings.Value;
    }

    public MessageChannel Channel => MessageChannel.Sms;

    public bool IsEnabled => _settings.Enabled;

    public Task<MessageSendResult> SendAsync(MessageRequest request, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            throw new ChannelDisabledException(MessageChannel.Sms);

        // No SMS provider adapter ships in v1. Enabling the flag without implementing an adapter is
        // a misconfiguration; surface it clearly rather than silently dropping the message.
        throw new NotSupportedException(
            "SMS is enabled in config but no provider adapter is implemented. Implement SmsChannelSender against a provider SDK before enabling.");
    }
}

/// <summary>
/// REQ-030 (E5-S4, AC-3): WhatsApp channel — a disabled stub, same contract as <see cref="SmsChannelSender"/>.
/// </summary>
public sealed class WhatsAppChannelSender : IMessageChannelSender
{
    private readonly WhatsAppSettings _settings;

    public WhatsAppChannelSender(IOptions<WhatsAppSettings> settings)
    {
        _settings = settings.Value;
    }

    public MessageChannel Channel => MessageChannel.WhatsApp;

    public bool IsEnabled => _settings.Enabled;

    public Task<MessageSendResult> SendAsync(MessageRequest request, CancellationToken cancellationToken = default)
    {
        if (!IsEnabled)
            throw new ChannelDisabledException(MessageChannel.WhatsApp);

        throw new NotSupportedException(
            "WhatsApp is enabled in config but no provider adapter is implemented. Implement WhatsAppChannelSender against a provider SDK before enabling.");
    }
}
