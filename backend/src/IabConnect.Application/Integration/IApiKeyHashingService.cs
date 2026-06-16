namespace IabConnect.Application.Integration;

/// <summary>
/// REQ-058 (E8-S1): generates and verifies external API secrets. Reuses the
/// <c>Member.HashCalendarToken</c> primitive — a high-entropy random token hashed with
/// <c>HMAC-SHA256(pepper, SHA256(secret))</c> and compared with
/// <c>CryptographicOperations.FixedTimeEquals</c> (DEC-4 = A; a slow password-KDF buys nothing
/// for 256-bit random tokens and would add latency on every authenticated external request).
/// </summary>
public interface IApiKeyHashingService
{
    /// <summary>Generates a fresh secret. The cleartext leaves the system exactly once (in the create response).</summary>
    GeneratedApiKey Generate();

    /// <summary>Computes the storable one-way hash of a raw key. Never stores the raw key.</summary>
    string Hash(string rawKey);

    /// <summary>Constant-time comparison of a presented raw key against a stored hash.</summary>
    bool Verify(string rawKey, string storedHash);

    /// <summary>
    /// Extracts the non-secret lookup prefix from a presented key (<c>iabc_{prefix}_{secret}</c>).
    /// Returns false on a malformed key so the auth handler can short-circuit before any DB lookup.
    /// </summary>
    bool TryParsePrefix(string presentedKey, out string prefix);
}

/// <summary>
/// REQ-058 (E8-S1): the output of <see cref="IApiKeyHashingService.Generate"/>. <see cref="RawSecret"/>
/// is the full cleartext key handed to the user once; <see cref="Prefix"/> is the non-secret lookup id;
/// <see cref="Hash"/> is the only value persisted alongside the prefix.
/// </summary>
public sealed record GeneratedApiKey(string RawSecret, string Prefix, string Hash);
