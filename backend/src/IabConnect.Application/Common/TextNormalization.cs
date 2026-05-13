using System.Globalization;
using System.Text;

namespace IabConnect.Application.Common;

/// <summary>
/// REQ-018 / REQ-023: Shared text normalization helpers used by duplicate matching
/// and event roster sorting.
/// Pure logic, no IO; safe to call from any layer above Domain.
/// </summary>
public static class TextNormalization
{
    /// <summary>
    /// Lower-cases, trims, expands German digraphs (ä→ae, ö→oe, ü→ue, ß→ss)
    /// BEFORE NFKD, then strips remaining combining marks. Produces a
    /// diacritic- and case-insensitive folded form suitable for equality
    /// comparison and ordering of names that mix scripts (Müller ↔ Mueller,
    /// Renée ↔ Renee).
    /// Returns <see cref="string.Empty"/> for null/whitespace input.
    /// </summary>
    public static string FoldName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name))
            return string.Empty;

        var lowered = name.Trim().ToLowerInvariant();

        // Expand German umlauts BEFORE NFKD; otherwise NFKD decomposes them
        // into base letter + combining mark and we lose the chance to spell
        // them out as digraphs. Required so "Müller" folds to the same value
        // as "Mueller".
        var expanded = new StringBuilder(lowered.Length + 4);
        foreach (var ch in lowered)
        {
            switch (ch)
            {
                case 'ä': expanded.Append("ae"); break;
                case 'ö': expanded.Append("oe"); break;
                case 'ü': expanded.Append("ue"); break;
                case 'ß': expanded.Append("ss"); break;
                default: expanded.Append(ch); break;
            }
        }

        var normalized = expanded.ToString().Normalize(NormalizationForm.FormKD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(ch) != UnicodeCategory.NonSpacingMark)
                sb.Append(ch);
        }
        return sb.ToString().Normalize(NormalizationForm.FormKC);
    }
}
