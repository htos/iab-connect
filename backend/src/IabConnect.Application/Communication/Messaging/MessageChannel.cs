namespace IabConnect.Application.Communication.Messaging;

/// <summary>
/// REQ-030 (E5-S4): the messaging channels the platform can send through. Email is the
/// always-enabled baseline; SMS/WhatsApp ship as disabled stub adapters until a provider is wired
/// in via Infrastructure + config (no workflow change required).
/// </summary>
public enum MessageChannel
{
    Email = 0,
    Sms = 1,
    WhatsApp = 2
}
