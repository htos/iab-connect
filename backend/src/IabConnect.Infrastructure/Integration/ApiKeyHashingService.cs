using System.Security.Cryptography;
using System.Text;
using IabConnect.Application.Integration;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S1, DEC-4 = A): generates and verifies external API secrets using the proven
/// <c>Member.HashCalendarToken</c> primitive — <c>HMAC-SHA256(pepper, SHA256(secret))</c> hex with
/// a constant-time compare. API secrets are 256-bit random tokens (high entropy), so a slow
/// password-KDF would add per-request latency on the hot auth path for no security gain.
///
/// <para>Key format: <c>iabc.{prefix}.{secret}</c> — <c>prefix</c> is a non-secret 12-hex-char
/// lookup id stored in cleartext; <c>secret</c> is Base64URL of 32 random bytes. The '.' separator
/// is outside the Base64URL alphabet (A–Z a–z 0–9 - _) so the secret part can be split off
/// unambiguously even though it may itself contain '-'/'_'.</para>
/// </summary>
public sealed class ApiKeyHashingService : IApiKeyHashingService
{
    private const string KeyScheme = "iabc";
    private const char Separator = '.';

    private readonly byte[]? _pepper;

    public ApiKeyHashingService(IOptions<ApiKeyOptions> options)
    {
        _pepper = options.Value.PepperBytes;
    }

    public GeneratedApiKey Generate()
    {
        var prefix = Convert.ToHexString(RandomNumberGenerator.GetBytes(6)).ToLowerInvariant(); // 12 hex chars
        var secret = Base64UrlEncode(RandomNumberGenerator.GetBytes(32));
        var rawKey = $"{KeyScheme}{Separator}{prefix}{Separator}{secret}";
        return new GeneratedApiKey(rawKey, prefix, Hash(rawKey));
    }

    public string Hash(string rawKey)
    {
        ArgumentException.ThrowIfNullOrEmpty(rawKey);
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes(rawKey));
        if (_pepper is null || _pepper.Length == 0)
            return Convert.ToHexString(digest).ToLowerInvariant();
        var hmac = HMACSHA256.HashData(_pepper, digest);
        return Convert.ToHexString(hmac).ToLowerInvariant();
    }

    public bool Verify(string rawKey, string storedHash)
    {
        if (string.IsNullOrEmpty(rawKey) || string.IsNullOrEmpty(storedHash))
            return false;
        var computed = Hash(rawKey);
        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(computed),
            Encoding.UTF8.GetBytes(storedHash));
    }

    public bool TryParsePrefix(string presentedKey, out string prefix)
    {
        prefix = string.Empty;
        if (string.IsNullOrWhiteSpace(presentedKey))
            return false;

        var parts = presentedKey.Split(Separator, 3);
        if (parts.Length != 3 || parts[0] != KeyScheme
            || string.IsNullOrEmpty(parts[1]) || string.IsNullOrEmpty(parts[2]))
            return false;

        prefix = parts[1];
        return true;
    }

    private static string Base64UrlEncode(byte[] data) =>
        Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
