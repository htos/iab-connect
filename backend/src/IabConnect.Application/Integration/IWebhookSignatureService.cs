namespace IabConnect.Application.Integration;

/// <summary>
/// REQ-058 (E8-S3, AC-3): computes and verifies the outbound webhook signature
/// <c>X-Webhook-Signature: sha256=&lt;lowercase-hex(HMAC-SHA256(secret, rawBody))&gt;</c> over the
/// exact raw bytes sent. Verification uses a constant-time compare.
/// </summary>
public interface IWebhookSignatureService
{
    /// <summary>Header name receivers read to verify a delivery.</summary>
    const string HeaderName = "X-Webhook-Signature";

    /// <summary>Returns <c>sha256=&lt;hex&gt;</c> for the given cleartext secret and raw body.</summary>
    string Sign(string secret, string rawBody);

    /// <summary>Constant-time verification of a presented <c>sha256=…</c> header.</summary>
    bool Verify(string secret, string rawBody, string signatureHeader);
}
