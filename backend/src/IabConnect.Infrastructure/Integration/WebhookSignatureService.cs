using System.Security.Cryptography;
using System.Text;
using IabConnect.Application.Integration;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S3, AC-3): computes <c>sha256=&lt;lowercase-hex(HMAC-SHA256(secret, rawBody))&gt;</c>
/// over the exact bytes sent, reusing the shipped HMAC + lowercase-hex idiom
/// (<c>Member.HashCalendarToken</c>). Verification is constant-time (<c>FixedTimeEquals</c>).
/// </summary>
public sealed class WebhookSignatureService : IWebhookSignatureService
{
    public string Sign(string secret, string rawBody)
    {
        ArgumentException.ThrowIfNullOrEmpty(secret);
        ArgumentNullException.ThrowIfNull(rawBody);
        var hmac = HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes(rawBody));
        return "sha256=" + Convert.ToHexString(hmac).ToLowerInvariant();
    }

    public bool Verify(string secret, string rawBody, string signatureHeader)
    {
        if (string.IsNullOrEmpty(signatureHeader)) return false;
        var expected = Sign(secret, rawBody);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(expected),
            Encoding.UTF8.GetBytes(signatureHeader));
    }
}
