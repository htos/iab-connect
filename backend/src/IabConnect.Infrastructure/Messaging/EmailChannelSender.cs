using IabConnect.Application.Communication.Messaging;
using IabConnect.Infrastructure.Email;

namespace IabConnect.Infrastructure.Messaging;

/// <summary>
/// REQ-030 (E5-S4, AC-2): the email channel — always enabled, the dispatcher's default + fallback.
/// Delegates to the existing <see cref="IEmailSender"/> (no SMTP re-implementation). Existing email
/// behaviour (campaigns, event-notifications) is unchanged — they keep calling <see cref="IEmailSender"/>
/// directly (DEC-3); only the automation send path routes through the dispatcher.
/// </summary>
public sealed class EmailChannelSender : IMessageChannelSender
{
    private readonly IEmailSender _emailSender;

    public EmailChannelSender(IEmailSender emailSender)
    {
        _emailSender = emailSender;
    }

    public MessageChannel Channel => MessageChannel.Email;

    public bool IsEnabled => true;

    public async Task<MessageSendResult> SendAsync(MessageRequest request, CancellationToken cancellationToken = default)
    {
        await _emailSender.SendAsync(
            request.RecipientEmail,
            request.Content.Subject,
            request.Content.HtmlBody,
            request.Content.TextBody,
            request.FromName,
            request.FromEmail,
            cancellationToken);

        return MessageSendResult.Sent(MessageChannel.Email);
    }
}
