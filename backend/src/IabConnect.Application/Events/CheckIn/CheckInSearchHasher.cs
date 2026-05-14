using System.Security.Cryptography;
using System.Text;

namespace IabConnect.Application.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2): Hashes a free-text manual-search query into a SHA-256 prefix suitable for
/// the <c>searchQueryHash</c> field of <c>LogAccessGranted.additionalData</c> when the manual
/// check-in endpoint records an audit row.
///
/// <para>Purpose: staff lookup queries may include partial PII ("Müll" → "Müller"), so we never
/// persist the raw input. The first 16 base64url chars of the SHA-256 digest are enough for
/// forensics (same admin querying the same term yields matching audit rows) without re-enabling
/// PII leakage. See <c>docs/07_dos_donts.md</c> A7 / A8 discipline and story decision D4.</para>
///
/// <para>Whitespace policy: the hasher trims surrounding whitespace and rejects null /
/// whitespace-only inputs (returns <see cref="string.Empty"/>) so the caller doesn't accidentally
/// audit the hash of an empty string. Unicode-normalised forms (precomposed <c>ä</c> vs decomposed
/// <c>a + combining diaeresis</c>) intentionally produce DIFFERENT hashes — they are different
/// inputs at the byte level, and there is no business need for cross-form equality on staff
/// search queries.</para>
///
/// <para>REQ-023 (E3.S2 Round-3 R3-M-S2-3): output uses base64url (RFC 4648 §5) — the standard
/// base64 alphabet's <c>+</c> and <c>/</c> characters are awkward inside JSON audit payloads (the
/// <c>/</c> in particular breaks URL routing if a downstream tool ever surfaces the hash in a
/// link, and <c>+</c> is interpreted as a space by some form parsers). Base64url substitutes
/// <c>+</c> → <c>-</c> and <c>/</c> → <c>_</c> so the hash is transport-safe in every common
/// consumer of audit data. Padding is irrelevant because we only emit the 16-char prefix.</para>
/// </summary>
public static class CheckInSearchHasher
{
    /// <summary>
    /// Length of the base64url-encoded prefix returned. 16 chars * 6 bits ≈ 96 bits of search-query
    /// entropy — well above what's needed to distinguish typical event-day lookup terms.
    /// </summary>
    public const int PrefixLength = 16;

    public static string Hash(string? rawInput)
    {
        if (string.IsNullOrWhiteSpace(rawInput))
            return string.Empty;

        var trimmed = rawInput.Trim();
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(trimmed));
        // Base64url: replace `+` → `-`, `/` → `_`; the 16-char prefix never includes padding.
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            [..PrefixLength];
    }
}
