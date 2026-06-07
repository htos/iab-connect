using System.Security.Cryptography;
using System.Text;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S3, DEC-2 = B): configuration for webhook signing-secret encryption at rest. Bound
/// from the <c>Auth</c> section (<c>Auth:WebhookEncryptionKey</c>, a base64-encoded 32-byte AES-256
/// key).
///
/// <para>When unset, a deterministic dev/CI fallback key is derived (documented, dev-only — like the
/// calendar-token pepper and unsubscribe-secret fallbacks). Production sets
/// <c>Auth__WebhookEncryptionKey</c> via the environment.</para>
/// </summary>
public sealed class WebhookOptions
{
    public const string SectionName = "Auth";

    public string? WebhookEncryptionKey { get; set; }

    /// <summary>The 32-byte AES-256 key: the configured base64 value, or a dev/CI fallback derived via SHA-256.</summary>
    public byte[] KeyBytes
    {
        get
        {
            if (!string.IsNullOrWhiteSpace(WebhookEncryptionKey))
            {
                var key = Convert.FromBase64String(WebhookEncryptionKey);
                if (key.Length != 32)
                    throw new InvalidOperationException("Auth:WebhookEncryptionKey must decode to 32 bytes (AES-256).");
                return key;
            }
            // Dev/CI fallback — deterministic, documented as non-production.
            return SHA256.HashData(Encoding.UTF8.GetBytes("iab-connect-webhook-dev-fallback-key"));
        }
    }
}
