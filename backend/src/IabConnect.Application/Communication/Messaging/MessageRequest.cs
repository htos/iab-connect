namespace IabConnect.Application.Communication.Messaging;

/// <summary>
/// REQ-030 (E5-S4): channel-agnostic message content. A channel sender maps it to its own
/// transport (email body, SMS text, …) so callers never depend on a channel's shape.
/// </summary>
public sealed record MessageContent(string Subject, string HtmlBody, string? TextBody);

/// <summary>
/// REQ-030 (E5-S4): a request to deliver a message to one recipient over a requested channel.
/// Carries enough recipient identity for any channel (email + optional phone + Keycloak user id).
/// </summary>
public sealed record MessageRequest(
    MessageChannel Channel,
    string RecipientEmail,
    string? RecipientPhone,
    Guid? UserId,
    MessageContent Content,
    string FromName,
    string FromEmail);

/// <summary>REQ-030 (E5-S4): the disposition of a dispatch attempt — the caller records it (e.g. S2's AutomationRecipient).</summary>
public enum MessageDeliveryStatus
{
    Sent = 0,
    Skipped = 1,
    Failed = 2
}

/// <summary>REQ-030 (E5-S4): the result of dispatching a <see cref="MessageRequest"/> — never throws to the caller.</summary>
public sealed record MessageSendResult(MessageDeliveryStatus Status, MessageChannel Channel, string? Reason)
{
    public bool IsSent => Status == MessageDeliveryStatus.Sent;

    public static MessageSendResult Sent(MessageChannel channel) => new(MessageDeliveryStatus.Sent, channel, null);
    public static MessageSendResult Skipped(MessageChannel channel, string reason) => new(MessageDeliveryStatus.Skipped, channel, reason);
    public static MessageSendResult Failed(MessageChannel channel, string error) => new(MessageDeliveryStatus.Failed, channel, error);
}
