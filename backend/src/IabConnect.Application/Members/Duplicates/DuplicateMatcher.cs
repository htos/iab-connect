using System.Text;
using IabConnect.Application.Common;
using IabConnect.Domain.Members;

namespace IabConnect.Application.Members.Duplicates;

/// <summary>
/// REQ-018: Deterministic duplicate-candidate matcher.
/// Pure logic, no IO; safe to register as a singleton.
/// </summary>
public interface IDuplicateMatcher
{
    /// <summary>
    /// Lower-cases, trims, and strips the local-part <c>+tag</c> alias.
    /// Returns <see cref="string.Empty"/> for null/whitespace input.
    /// </summary>
    string NormalizeEmail(string? email);

    /// <summary>
    /// Extracts the digit characters from a phone string.
    /// Returns <see cref="string.Empty"/> for null/whitespace or no-digit input.
    /// </summary>
    string NormalizePhoneDigits(string? phone);

    /// <summary>
    /// Lower-cases, trims, and strips diacritics from a name component.
    /// Returns <see cref="string.Empty"/> for null/whitespace input.
    /// </summary>
    string FoldName(string? name);

    /// <summary>
    /// Determines whether <paramref name="candidate"/> is a duplicate of <paramref name="input"/>.
    /// </summary>
    /// <returns>
    /// <c>(Tier: Exact, Reason: Email)</c> when normalized emails agree.
    /// <c>(Tier: Likely, Reason: NameOnly | signal)</c> when normalized first+last name agree AND at least one of phone / postal+street / email-local-part agrees.
    /// <c>(Tier: null, Reason: None or NameOnly)</c> otherwise.
    /// Same-Id pairs always return <c>(null, None)</c>.
    /// </returns>
    (MatchTier? Tier, MatchReason Reason) EvaluateCandidate(Member input, Member candidate);
}

/// <summary>
/// Default deterministic matcher implementation. See <see cref="IDuplicateMatcher"/>.
/// </summary>
public sealed class DuplicateMatcher : IDuplicateMatcher
{
    public string NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
            return string.Empty;

        var trimmed = email.Trim().ToLowerInvariant();
        var atIdx = trimmed.IndexOf('@');
        if (atIdx <= 0)
            return trimmed;

        var local = trimmed[..atIdx];
        var domain = trimmed[(atIdx + 1)..];

        var plusIdx = local.IndexOf('+');
        if (plusIdx >= 0)
            local = local[..plusIdx];

        return local.Length == 0 ? trimmed : $"{local}@{domain}";
    }

    public string NormalizePhoneDigits(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return string.Empty;

        var sb = new StringBuilder(phone.Length);
        foreach (var ch in phone)
        {
            if (char.IsDigit(ch))
                sb.Append(ch);
        }
        return sb.ToString();
    }

    public string FoldName(string? name) => TextNormalization.FoldName(name);

    public (MatchTier? Tier, MatchReason Reason) EvaluateCandidate(Member input, Member candidate)
    {
        if (input.Id != Guid.Empty && input.Id == candidate.Id)
            return (null, MatchReason.None);

        var inputEmail = NormalizeEmail(input.Email);
        var candEmail = NormalizeEmail(candidate.Email);

        if (inputEmail.Length > 0 && string.Equals(inputEmail, candEmail, StringComparison.Ordinal))
            return (MatchTier.Exact, MatchReason.Email);

        var inputFirst = FoldName(input.FirstName);
        var inputLast = FoldName(input.LastName);
        var candFirst = FoldName(candidate.FirstName);
        var candLast = FoldName(candidate.LastName);

        var namesMatch = inputFirst.Length > 0
            && inputLast.Length > 0
            && string.Equals(inputFirst, candFirst, StringComparison.Ordinal)
            && string.Equals(inputLast, candLast, StringComparison.Ordinal);

        if (!namesMatch)
            return (null, MatchReason.None);

        var reason = MatchReason.NameOnly;

        var inputPhone = NormalizePhoneDigits(input.Phone);
        var candPhone = NormalizePhoneDigits(candidate.Phone);
        if (inputPhone.Length > 0 && string.Equals(inputPhone, candPhone, StringComparison.Ordinal))
            reason |= MatchReason.NormalizedPhone;

        var inputPostal = (input.Address?.PostalCode ?? string.Empty).Trim();
        var candPostal = (candidate.Address?.PostalCode ?? string.Empty).Trim();
        var inputStreet = FoldName(input.Address?.Street);
        var candStreet = FoldName(candidate.Address?.Street);

        if (inputPostal.Length > 0
            && string.Equals(inputPostal, candPostal, StringComparison.Ordinal)
            && inputStreet.Length > 0
            && candStreet.Length > 0
            && (inputStreet.StartsWith(candStreet, StringComparison.Ordinal)
                || candStreet.StartsWith(inputStreet, StringComparison.Ordinal)))
        {
            reason |= MatchReason.PostalAndStreet;
        }

        var inputLocal = ExtractLocalPart(inputEmail);
        var candLocal = ExtractLocalPart(candEmail);
        if (inputLocal.Length > 0 && string.Equals(inputLocal, candLocal, StringComparison.Ordinal))
            reason |= MatchReason.EmailLocalPart;

        if (reason == MatchReason.NameOnly)
            return (null, reason);

        return (MatchTier.Likely, reason);
    }

    private static string ExtractLocalPart(string normalizedEmail)
    {
        if (string.IsNullOrEmpty(normalizedEmail))
            return string.Empty;
        var at = normalizedEmail.IndexOf('@');
        return at <= 0 ? string.Empty : normalizedEmail[..at];
    }
}
