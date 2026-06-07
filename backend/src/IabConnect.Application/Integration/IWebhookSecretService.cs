namespace IabConnect.Application.Integration;

/// <summary>
/// REQ-058 (E8-S3, AC-4): generates webhook signing secrets and protects them at rest (AES-256-GCM,
/// DEC-2 = B). The server must be able to recover the cleartext to sign each outbound delivery
/// (E8-S4), so storage is reversible — never a one-way hash. The cleartext leaves the system once
/// (shown to the operator at create/rotate).
/// </summary>
public interface IWebhookSecretService
{
    /// <summary>Generates a fresh secret and its encrypted-at-rest representation.</summary>
    GeneratedWebhookSecret Generate();

    /// <summary>Recovers the cleartext secret from its stored cipher (used at signing time).</summary>
    string Reveal(string protectedSecret);
}

/// <summary>
/// <see cref="RawSecret"/> is the one-time cleartext returned to the operator; <see cref="ProtectedSecret"/>
/// is the encrypted value persisted on the subscription.
/// </summary>
public sealed record GeneratedWebhookSecret(string RawSecret, string ProtectedSecret);
