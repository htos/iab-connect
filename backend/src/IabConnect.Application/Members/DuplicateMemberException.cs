namespace IabConnect.Application.Members;

/// <summary>
/// REQ-018: Thrown by member create/update flows when the submitted email
/// normalizes to an existing member's email (case-insensitive, <c>+tag</c> stripped).
/// Carries <see cref="ExistingMemberId"/> so the HTTP layer can include it in a
/// 409 Conflict response body and the UI can deep-link to the existing record.
/// </summary>
public sealed class DuplicateMemberException : Exception
{
    public Guid ExistingMemberId { get; }
    public string NormalizedEmail { get; }

    public DuplicateMemberException(Guid existingMemberId, string normalizedEmail)
        : base($"A member with the normalized email '{normalizedEmail}' already exists (id={existingMemberId}).")
    {
        ExistingMemberId = existingMemberId;
        NormalizedEmail = normalizedEmail;
    }
}
