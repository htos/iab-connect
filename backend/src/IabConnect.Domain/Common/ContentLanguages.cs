namespace IabConnect.Domain.Common;

/// <summary>
/// REQ-055 (E7-S4): supported content-language codes (ISO 639-1) for public,
/// author-managed content (Event, BlogPost). Aligned with the app's i18n UI
/// locales introduced in E7-S3 (de/en/hi). Stored as a nullable string on the
/// entity (DEC-2 = A — mirrors <c>InvoiceTemplate.Language</c>, not a new enum);
/// <c>null</c> means "no explicit language / use the organization default"
/// (E7-S4 AC-2, data-preserving for pre-migration rows).
/// </summary>
public static class ContentLanguages
{
    /// <summary>Supported ISO 639-1 content-language codes (E7-S4 DEC-3 = A).</summary>
    public static readonly IReadOnlySet<string> Supported =
        new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "de", "en", "hi" };

    /// <summary>
    /// Normalizes a caller-supplied content-language value at the write boundary:
    /// null/whitespace becomes <c>null</c> (unset); otherwise the value is trimmed
    /// and lower-cased and validated against <see cref="Supported"/>. An unsupported
    /// code throws <see cref="ArgumentException"/> (mapped to HTTP 400 by the API's
    /// ExceptionHandlingMiddleware) so arbitrary strings are never persisted.
    /// </summary>
    public static string? Normalize(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return null;
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (!Supported.Contains(normalized))
        {
            throw new ArgumentException(
                $"Unsupported content language '{value}'. Supported codes: {string.Join(", ", Supported)}.",
                nameof(value));
        }

        return normalized;
    }
}
