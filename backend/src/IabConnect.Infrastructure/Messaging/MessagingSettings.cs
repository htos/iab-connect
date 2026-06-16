namespace IabConnect.Infrastructure.Messaging;

/// <summary>
/// REQ-030 (E5-S4, AC-5): SMS provider settings, bound from the <c>"Sms"</c> config section
/// (`services.Configure&lt;SmsSettings&gt;(GetSection("Sms"))`, the SmtpSettings precedent).
/// Disabled + empty by default — credentials are config secrets (env vars / Railway secrets),
/// never literals in source. <c>appsettings.json</c> carries only the disabled, non-secret stanza.
/// </summary>
public sealed class SmsSettings
{
    public const string SectionName = "Sms";

    public bool Enabled { get; set; }
    public string? Provider { get; set; }
    public string? AccountSid { get; set; }
    public string? AuthToken { get; set; }
    public string? FromNumber { get; set; }
}

/// <summary>
/// REQ-030 (E5-S4, AC-5): WhatsApp provider settings, bound from the <c>"WhatsApp"</c> config
/// section. Disabled + empty by default; secrets via config only.
/// </summary>
public sealed class WhatsAppSettings
{
    public const string SectionName = "WhatsApp";

    public bool Enabled { get; set; }
    public string? Provider { get; set; }
    public string? AccessToken { get; set; }
    public string? PhoneNumberId { get; set; }
}
