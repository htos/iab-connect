using System.Text;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S1): the server-side secret that keys the API-key hash with HMAC. Bound from the
/// <c>Auth</c> configuration section (<c>Auth:ApiKeyPepper</c>), mirroring
/// <see cref="IabConnect.Infrastructure.Events.CalendarTokenOptions"/>.
///
/// <para>When the pepper is empty the hash falls back to plain SHA-256 — the backwards-compatible
/// default for local dev / CI. Production sets <c>Auth__ApiKeyPepper</c> via the environment so a
/// database compromise alone cannot confirm a credential even against a known cleartext key.</para>
/// </summary>
public sealed class ApiKeyOptions
{
    public const string SectionName = "Auth";

    public string? ApiKeyPepper { get; set; }

    /// <summary>UTF-8 bytes of the configured pepper, or null when no pepper is configured.</summary>
    public byte[]? PepperBytes =>
        string.IsNullOrEmpty(ApiKeyPepper) ? null : Encoding.UTF8.GetBytes(ApiKeyPepper);
}
