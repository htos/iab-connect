// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Security.Cryptography;
using System.Text;
using FluentAssertions;
using IabConnect.Infrastructure.Backup;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Backup;

/// <summary>
/// REQ-088 AC-6 (E15-S3 / ADR-019): unit tests for <see cref="BackupEncryption"/>.
/// AES-256-GCM round-trip + tamper detection + key validation. No Postgres / no
/// S3 / no Hangfire — pure crypto stream behaviour.
/// </summary>
public sealed class BackupEncryptionTests
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    private static byte[] NewKey()
    {
        var key = new byte[BackupEncryption.KeySizeBytes];
        RandomNumberGenerator.Fill(key);
        return key;
    }

    [Fact]
    public async Task EncryptDecrypt_RoundTrip_PreservesPlaintextBytes()
    {
        var key = NewKey();
        var plain = Encoding.UTF8.GetBytes("hello pg_dump output — bytes that include high-codepoints: ä, ø, 🌍");

        using var src = new MemoryStream(plain);
        using var cipher = new MemoryStream();
        await BackupEncryption.EncryptAsync(src, cipher, key, Ct);

        cipher.Position = 0;
        using var decrypted = new MemoryStream();
        await BackupEncryption.DecryptAsync(cipher, decrypted, key, Ct);

        decrypted.ToArray().Should().Equal(plain);
    }

    [Fact]
    public async Task Encrypt_ProducesNonceTagCiphertextLayout()
    {
        var key = NewKey();
        var plain = new byte[1024];
        RandomNumberGenerator.Fill(plain);

        using var src = new MemoryStream(plain);
        using var cipher = new MemoryStream();
        await BackupEncryption.EncryptAsync(src, cipher, key, Ct);

        // Layout: [12-byte nonce][16-byte tag][ciphertext same length as plaintext]
        cipher.Length.Should().Be(
            BackupEncryption.NonceSizeBytes + BackupEncryption.TagSizeBytes + plain.Length);
    }

    [Fact]
    public async Task Encrypt_EachInvocationProducesDistinctNonce_DeterministicPlaintextProducesNonDeterministicCiphertext()
    {
        // Per NIST SP 800-38D the GCM nonce MUST NOT repeat under the same key.
        // BackupEncryption uses a fresh CSPRNG nonce per call, so two encryptions
        // of the same plaintext under the same key produce distinct ciphertexts —
        // confirms the random-nonce contract from the implementation comment.
        var key = NewKey();
        var plain = Encoding.UTF8.GetBytes("identical input bytes");

        using var c1 = new MemoryStream();
        using var c2 = new MemoryStream();
        await BackupEncryption.EncryptAsync(new MemoryStream(plain), c1, key, Ct);
        await BackupEncryption.EncryptAsync(new MemoryStream(plain), c2, key, Ct);

        c1.ToArray().Should().NotEqual(c2.ToArray());
    }

    [Fact]
    public async Task Decrypt_TamperedCiphertext_ThrowsCryptographicException()
    {
        var key = NewKey();
        var plain = Encoding.UTF8.GetBytes("backup payload");

        using var src = new MemoryStream(plain);
        using var cipher = new MemoryStream();
        await BackupEncryption.EncryptAsync(src, cipher, key, Ct);

        // Flip one byte in the ciphertext region (past the 12-byte nonce + 16-byte tag).
        var tampered = cipher.ToArray();
        var tamperPos = BackupEncryption.NonceSizeBytes + BackupEncryption.TagSizeBytes + 2;
        tampered[tamperPos] ^= 0xFF;

        using var input = new MemoryStream(tampered);
        using var output = new MemoryStream();

        var act = async () => await BackupEncryption.DecryptAsync(input, output, key, Ct);
        await act.Should().ThrowAsync<CryptographicException>();
    }

    [Fact]
    public async Task Decrypt_WrongKey_ThrowsCryptographicException()
    {
        var encryptKey = NewKey();
        var decryptKey = NewKey();
        var plain = Encoding.UTF8.GetBytes("backup payload");

        using var cipher = new MemoryStream();
        await BackupEncryption.EncryptAsync(new MemoryStream(plain), cipher, encryptKey, Ct);
        cipher.Position = 0;

        using var output = new MemoryStream();
        var act = async () => await BackupEncryption.DecryptAsync(cipher, output, decryptKey, Ct);
        await act.Should().ThrowAsync<CryptographicException>();
    }

    [Theory]
    [InlineData(0)]
    [InlineData(16)]
    [InlineData(31)]
    [InlineData(33)]
    [InlineData(64)]
    public async Task EncryptDecrypt_RejectWrongKeySize(int wrongSize)
    {
        // AES-256-GCM requires a 32-byte key; any other length must be rejected at
        // both encrypt and decrypt entry points to keep the contract symmetric.
        var key = new byte[wrongSize];
        RandomNumberGenerator.Fill(key);

        var act1 = async () => await BackupEncryption.EncryptAsync(
            new MemoryStream(new byte[10]), new MemoryStream(), key, Ct);
        var act2 = async () => await BackupEncryption.DecryptAsync(
            new MemoryStream(new byte[40]), new MemoryStream(), key, Ct);

        await act1.Should().ThrowAsync<ArgumentException>();
        await act2.Should().ThrowAsync<ArgumentException>();
    }

    [Fact]
    public void ParseConfiguredKey_ValidBase64_Returns32Bytes()
    {
        var raw = new byte[BackupEncryption.KeySizeBytes];
        RandomNumberGenerator.Fill(raw);
        var b64 = Convert.ToBase64String(raw);

        var parsed = BackupEncryption.ParseConfiguredKey(b64);
        parsed.Should().Equal(raw);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void ParseConfiguredKey_MissingValue_Throws(string? input)
    {
        // Fail-fast: a missing Backup__EncryptionKey on non-Dev startup MUST throw
        // — never silently fall back to plaintext. This is the contract that
        // PostgresBackupService relies on for its constructor fail-fast posture.
        var act = () => BackupEncryption.ParseConfiguredKey(input);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*Backup__EncryptionKey is not configured*");
    }

    [Fact]
    public void ParseConfiguredKey_NotBase64_Throws()
    {
        var act = () => BackupEncryption.ParseConfiguredKey("not-base64 because spaces and !!!");
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*not valid base64*");
    }

    [Fact]
    public void ParseConfiguredKey_WrongLength_Throws()
    {
        // Valid base64 but decodes to 16 bytes (AES-128 key length) instead of 32.
        var aes128 = new byte[16];
        RandomNumberGenerator.Fill(aes128);
        var b64 = Convert.ToBase64String(aes128);

        var act = () => BackupEncryption.ParseConfiguredKey(b64);
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*must decode to 32 bytes*");
    }
}
