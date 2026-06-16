namespace IabConnect.Application.Communication.Messaging;

/// <summary>
/// REQ-030 (E5-S4): a per-channel sender. The dispatcher picks the enabled sender for a requested
/// channel. Adding a real SMS/WhatsApp provider = implement this against a provider SDK (behind
/// <see cref="IMessageProvider"/>) + flip <see cref="IsEnabled"/> via config — no change to
/// <see cref="IMessageDispatcher"/> or any caller.
/// </summary>
public interface IMessageChannelSender
{
    MessageChannel Channel { get; }

    /// <summary>Whether this channel is configured + enabled. Disabled senders must not send.</summary>
    bool IsEnabled { get; }

    /// <summary>Send the message over this channel. Throws <see cref="ChannelDisabledException"/> if invoked while disabled.</summary>
    Task<MessageSendResult> SendAsync(MessageRequest request, CancellationToken cancellationToken = default);
}

/// <summary>
/// REQ-030 (E5-S4): provider-adapter seam. A channel sender that talks to a third-party provider
/// (Twilio, WhatsApp Cloud API, …) holds an <see cref="IMessageProvider"/>; swapping providers is
/// a new adapter, not a workflow change.
/// </summary>
public interface IMessageProvider
{
    string Name { get; }
}

/// <summary>
/// REQ-030 (E5-S4): selects the right enabled <see cref="IMessageChannelSender"/> for a request and
/// degrades gracefully when the requested channel is disabled (DEC-2: fall back to email where
/// sensible, else a clear Skipped result — never a crash).
/// </summary>
public interface IMessageDispatcher
{
    Task<MessageSendResult> DispatchAsync(MessageRequest request, CancellationToken cancellationToken = default);
}

/// <summary>REQ-030 (E5-S4, DEC-2): thrown when a disabled channel sender is invoked directly; the dispatcher catches it.</summary>
public sealed class ChannelDisabledException : Exception
{
    public MessageChannel Channel { get; }

    public ChannelDisabledException(MessageChannel channel)
        : base($"The {channel} channel is disabled and cannot send.")
    {
        Channel = channel;
    }
}
