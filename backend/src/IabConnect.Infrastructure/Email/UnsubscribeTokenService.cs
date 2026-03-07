using System.Security.Cryptography;
using System.Text;
using IabConnect.Application.Communication;
using Microsoft.Extensions.Configuration;

namespace IabConnect.Infrastructure.Email;

/// <summary>
/// REQ-029: HMAC-SHA256-based unsubscribe token generation and validation.
/// Token format: Base64Url(recipientId_bytes + hmac_bytes)
/// </summary>
public sealed class UnsubscribeTokenService : IUnsubscribeTokenService
{
    private readonly byte[] _key;

    public UnsubscribeTokenService(IConfiguration configuration)
    {
        var secret = configuration["Email:UnsubscribeSecret"]
            ?? configuration["Smtp:FromEmail"]
            ?? "iab-connect-unsubscribe-default-key";
        _key = SHA256.HashData(Encoding.UTF8.GetBytes(secret));
    }

    public string GenerateToken(Guid recipientId)
    {
        var idBytes = recipientId.ToByteArray();
        var hmac = ComputeHmac(idBytes);

        var payload = new byte[idBytes.Length + hmac.Length];
        idBytes.CopyTo(payload, 0);
        hmac.CopyTo(payload, idBytes.Length);

        return Base64UrlEncode(payload);
    }

    public Guid? ValidateToken(string token)
    {
        byte[] payload;
        try
        {
            payload = Base64UrlDecode(token);
        }
        catch
        {
            return null;
        }

        if (payload.Length != 16 + 32) // Guid (16) + HMAC-SHA256 (32)
            return null;

        var idBytes = payload[..16];
        var providedHmac = payload[16..];
        var expectedHmac = ComputeHmac(idBytes);

        if (!CryptographicOperations.FixedTimeEquals(providedHmac, expectedHmac))
            return null;

        return new Guid(idBytes);
    }

    private byte[] ComputeHmac(byte[] data)
    {
        using var hmac = new HMACSHA256(_key);
        return hmac.ComputeHash(data);
    }

    private static string Base64UrlEncode(byte[] data)
    {
        return Convert.ToBase64String(data)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    private static byte[] Base64UrlDecode(string input)
    {
        var base64 = input.Replace('-', '+').Replace('_', '/');
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }
}
