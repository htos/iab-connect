// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Security.Cryptography;

namespace IabConnect.Infrastructure.Backup;

/// <summary>
/// REQ-088 AC-6 (E15-S3 / ADR-019): AES-256-GCM stream encryption used to encrypt
/// gzipped <c>pg_dump</c> output before upload to RustFS. The disk format is
/// <c>[12-byte nonce][16-byte tag][ciphertext]</c> — fixed-size headers followed by
/// the raw ciphertext bytes (length matches the plaintext length).
///
/// <para>Authenticated encryption (AES-GCM) is chosen over CBC + HMAC because the
/// 16-byte GCM tag detects tampering at decryption time. A corrupted RustFS-stored
/// backup fails at decryption with <see cref="CryptographicException"/> rather than
/// silently producing garbage that <c>pg_restore</c> would later refuse with an
/// opaque error.</para>
///
/// <para>This implementation loads the ciphertext fully into memory for the AesGcm
/// API which operates on byte arrays rather than streams. The Beta dataset's
/// pg_dump output is bounded to tens of MB; if a future requirement demands chunked
/// streaming, the format header layout (12 + 16 bytes) is preserved by switching to
/// <c>AesGcm</c> per-chunk with a chunk-counter as additional authenticated data.</para>
/// </summary>
public static class BackupEncryption
{
    /// <summary>AES-256 key length in bytes (per FIPS 197).</summary>
    public const int KeySizeBytes = 32;

    /// <summary>Random per-message nonce length used by this implementation (NIST SP 800-38D recommends 12).</summary>
    public const int NonceSizeBytes = 12;

    /// <summary>GCM authentication tag length in bytes (the maximum supported by AesGcm).</summary>
    public const int TagSizeBytes = 16;

    /// <summary>
    /// Encrypts the entire content of <paramref name="plaintext"/> with AES-256-GCM
    /// and writes <c>[nonce][tag][ciphertext]</c> to <paramref name="ciphertext"/>.
    /// Throws <see cref="ArgumentException"/> if <paramref name="key"/> is not
    /// <see cref="KeySizeBytes"/> bytes.
    /// </summary>
    public static async Task EncryptAsync(
        Stream plaintext,
        Stream ciphertext,
        byte[] key,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(plaintext);
        ArgumentNullException.ThrowIfNull(ciphertext);
        ArgumentNullException.ThrowIfNull(key);
        if (key.Length != KeySizeBytes)
        {
            throw new ArgumentException(
                $"AES-256-GCM requires a {KeySizeBytes}-byte key; got {key.Length} bytes.",
                nameof(key));
        }

        // Read the full plaintext. The pg_dump output is bounded (tens of MB for Beta);
        // a chunked-streaming variant would preserve the same header layout — see class XML doc.
        using var plaintextBuffer = new MemoryStream();
        await plaintext.CopyToAsync(plaintextBuffer, ct).ConfigureAwait(false);
        var plaintextBytes = plaintextBuffer.ToArray();

        var nonce = new byte[NonceSizeBytes];
        RandomNumberGenerator.Fill(nonce);
        var tag = new byte[TagSizeBytes];
        var cipherBytes = new byte[plaintextBytes.Length];

        using (var aes = new AesGcm(key, TagSizeBytes))
        {
            aes.Encrypt(nonce, plaintextBytes, cipherBytes, tag);
        }

        await ciphertext.WriteAsync(nonce, ct).ConfigureAwait(false);
        await ciphertext.WriteAsync(tag, ct).ConfigureAwait(false);
        await ciphertext.WriteAsync(cipherBytes, ct).ConfigureAwait(false);
        await ciphertext.FlushAsync(ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Decrypts content written by <see cref="EncryptAsync"/>. Throws
    /// <see cref="CryptographicException"/> (specifically the GCM
    /// <c>AuthenticationTagMismatchException</c>) when the ciphertext was tampered
    /// with or when the wrong key is used.
    /// </summary>
    public static async Task DecryptAsync(
        Stream ciphertext,
        Stream plaintext,
        byte[] key,
        CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(ciphertext);
        ArgumentNullException.ThrowIfNull(plaintext);
        ArgumentNullException.ThrowIfNull(key);
        if (key.Length != KeySizeBytes)
        {
            throw new ArgumentException(
                $"AES-256-GCM requires a {KeySizeBytes}-byte key; got {key.Length} bytes.",
                nameof(key));
        }

        var nonce = new byte[NonceSizeBytes];
        await ReadExactAsync(ciphertext, nonce, ct).ConfigureAwait(false);
        var tag = new byte[TagSizeBytes];
        await ReadExactAsync(ciphertext, tag, ct).ConfigureAwait(false);

        using var remainder = new MemoryStream();
        await ciphertext.CopyToAsync(remainder, ct).ConfigureAwait(false);
        var cipherBytes = remainder.ToArray();
        var plainBytes = new byte[cipherBytes.Length];

        using (var aes = new AesGcm(key, TagSizeBytes))
        {
            // Throws AuthenticationTagMismatchException (a CryptographicException subclass)
            // when the tag doesn't validate — wrong key OR tampered ciphertext.
            aes.Decrypt(nonce, cipherBytes, tag, plainBytes);
        }

        await plaintext.WriteAsync(plainBytes, ct).ConfigureAwait(false);
        await plaintext.FlushAsync(ct).ConfigureAwait(false);
    }

    /// <summary>
    /// Parses a base64-encoded 32-byte AES-256 key from configuration. Throws
    /// <see cref="InvalidOperationException"/> on missing/invalid input — backup
    /// encryption must never silently fall back to plaintext.
    /// </summary>
    public static byte[] ParseConfiguredKey(string? base64)
    {
        if (string.IsNullOrWhiteSpace(base64))
        {
            throw new InvalidOperationException(
                "Backup__EncryptionKey is not configured. Backups MUST be encrypted; refusing to run without a key.");
        }

        byte[] key;
        try
        {
            key = Convert.FromBase64String(base64);
        }
        catch (FormatException ex)
        {
            throw new InvalidOperationException(
                "Backup__EncryptionKey is not valid base64. Provide a base64-encoded 32-byte AES-256 key.",
                ex);
        }

        if (key.Length != KeySizeBytes)
        {
            throw new InvalidOperationException(
                $"Backup__EncryptionKey must decode to {KeySizeBytes} bytes (AES-256); got {key.Length} bytes.");
        }

        return key;
    }

    private static async Task ReadExactAsync(Stream source, byte[] buffer, CancellationToken ct)
    {
        var read = 0;
        while (read < buffer.Length)
        {
            var n = await source.ReadAsync(buffer.AsMemory(read), ct).ConfigureAwait(false);
            if (n == 0)
            {
                throw new InvalidDataException(
                    $"Backup ciphertext truncated: expected {buffer.Length} bytes, got {read} before EOF.");
            }
            read += n;
        }
    }
}
