using System.Security.Cryptography;
using IabConnect.Application.Integration;
using Microsoft.Extensions.Options;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S3, AC-4 / DEC-2 = B): generates webhook signing secrets and protects them at rest
/// with AES-256-GCM (the <c>BackupEncryption</c> primitive, applied to a short string). The on-disk
/// format is base64(<c>[12-byte nonce][16-byte tag][ciphertext]</c>). Reversible because the server
/// must recover the cleartext to sign each outbound delivery (E8-S4) — a one-way hash is infeasible.
/// </summary>
public sealed class WebhookSecretService : IWebhookSecretService
{
    private const int NonceSize = 12;
    private const int TagSize = 16;

    private readonly byte[] _key;

    public WebhookSecretService(IOptions<WebhookOptions> options)
    {
        _key = options.Value.KeyBytes;
    }

    public GeneratedWebhookSecret Generate()
    {
        var raw = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32))
            .TrimEnd('=').Replace('+', '-').Replace('/', '_');
        return new GeneratedWebhookSecret(raw, Protect(raw));
    }

    public string Reveal(string protectedSecret)
    {
        ArgumentException.ThrowIfNullOrEmpty(protectedSecret);
        var blob = Convert.FromBase64String(protectedSecret);
        var nonce = blob.AsSpan(0, NonceSize).ToArray();
        var tag = blob.AsSpan(NonceSize, TagSize).ToArray();
        var cipher = blob.AsSpan(NonceSize + TagSize).ToArray();
        var plain = new byte[cipher.Length];
        using var aes = new AesGcm(_key, TagSize);
        aes.Decrypt(nonce, cipher, tag, plain);
        return System.Text.Encoding.UTF8.GetString(plain);
    }

    private string Protect(string plaintext)
    {
        var plainBytes = System.Text.Encoding.UTF8.GetBytes(plaintext);
        var nonce = RandomNumberGenerator.GetBytes(NonceSize);
        var tag = new byte[TagSize];
        var cipher = new byte[plainBytes.Length];
        using (var aes = new AesGcm(_key, TagSize))
        {
            aes.Encrypt(nonce, plainBytes, cipher, tag);
        }
        var blob = new byte[NonceSize + TagSize + cipher.Length];
        nonce.CopyTo(blob, 0);
        tag.CopyTo(blob, NonceSize);
        cipher.CopyTo(blob, NonceSize + TagSize);
        return Convert.ToBase64String(blob);
    }
}
