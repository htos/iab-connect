using IabConnect.Application.Communication.Messaging;
using Microsoft.Extensions.Logging;

namespace IabConnect.Infrastructure.Messaging;

/// <summary>
/// REQ-030 (E5-S4): selects the enabled <see cref="IMessageChannelSender"/> for a request and
/// degrades gracefully (DEC-2): a disabled requested channel falls back to email (if enabled), else
/// returns a clear <see cref="MessageDeliveryStatus.Skipped"/> result. Provider failures are caught
/// and returned as a failed result — never an unhandled crash (AC-4). Adding a channel sender to DI
/// is the only change needed for a new channel to be dispatchable (AC-3 — closed for modification).
/// </summary>
public sealed class MessageDispatcher : IMessageDispatcher
{
    private readonly IReadOnlyList<IMessageChannelSender> _senders;
    private readonly ILogger<MessageDispatcher> _logger;

    public MessageDispatcher(IEnumerable<IMessageChannelSender> senders, ILogger<MessageDispatcher> logger)
    {
        _senders = senders.ToList();
        _logger = logger;
    }

    public async Task<MessageSendResult> DispatchAsync(MessageRequest request, CancellationToken cancellationToken = default)
    {
        var sender = _senders.FirstOrDefault(s => s.Channel == request.Channel);

        if (sender is { IsEnabled: true })
        {
            try
            {
                return await sender.SendAsync(request, cancellationToken);
            }
            catch (ChannelDisabledException)
            {
                // Race between the IsEnabled check and the send — fall through to the fallback.
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Message dispatch failed on channel {Channel}", request.Channel);
                return MessageSendResult.Failed(request.Channel, ex.Message);
            }
        }

        // Requested channel unavailable → fall back to email if it is enabled and different.
        if (request.Channel != MessageChannel.Email)
        {
            var email = _senders.FirstOrDefault(s => s.Channel == MessageChannel.Email);
            if (email is { IsEnabled: true })
            {
                _logger.LogInformation(
                    "Message dispatch: channel {Channel} disabled — falling back to Email", request.Channel);
                try
                {
                    return await email.SendAsync(request with { Channel = MessageChannel.Email }, cancellationToken);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Message dispatch email fallback failed");
                    return MessageSendResult.Failed(MessageChannel.Email, ex.Message);
                }
            }
        }

        _logger.LogWarning("Message dispatch: no enabled sender for channel {Channel} and no email fallback", request.Channel);
        return MessageSendResult.Skipped(request.Channel, "channel disabled");
    }
}
