using System.Net;
using System.Net.Sockets;

namespace IabConnect.Infrastructure.Integration;

/// <summary>
/// REQ-058 (E8-S4): SSRF protection for outbound webhook delivery (net-new — no in-repo precedent).
/// Blocks target URLs that resolve to private, loopback, link-local, unique-local or CGNAT address
/// ranges so a webhook subscription cannot be used to probe the internal network.
/// </summary>
public static class SsrfGuard
{
    /// <summary>
    /// Returns true (blocked) when the target is not a public https endpoint. A literal IP is checked
    /// directly; a hostname is resolved and blocked if ANY resolved address is non-public. Resolution
    /// failure fails CLOSED (blocked) — safer for an SSRF guard.
    /// </summary>
    public static async Task<bool> IsBlockedAsync(Uri uri, CancellationToken ct = default)
    {
        if (uri.Scheme != Uri.UriSchemeHttps)
            return true;

        var host = uri.DnsSafeHost;

        if (IPAddress.TryParse(host, out var literal))
            return IsNonPublic(literal);

        if (string.Equals(host, "localhost", StringComparison.OrdinalIgnoreCase))
            return true;

        try
        {
            var addresses = await Dns.GetHostAddressesAsync(host, ct);
            return addresses.Length == 0 || addresses.Any(IsNonPublic);
        }
        catch
        {
            return true; // fail closed
        }
    }

    private static bool IsNonPublic(IPAddress ip)
    {
        if (IPAddress.IsLoopback(ip))
            return true;

        if (ip.AddressFamily == AddressFamily.InterNetwork)
        {
            var b = ip.GetAddressBytes();
            // 10.0.0.0/8
            if (b[0] == 10) return true;
            // 172.16.0.0/12
            if (b[0] == 172 && b[1] >= 16 && b[1] <= 31) return true;
            // 192.168.0.0/16
            if (b[0] == 192 && b[1] == 168) return true;
            // 169.254.0.0/16 link-local
            if (b[0] == 169 && b[1] == 254) return true;
            // 100.64.0.0/10 CGNAT
            if (b[0] == 100 && b[1] >= 64 && b[1] <= 127) return true;
            // 0.0.0.0/8
            if (b[0] == 0) return true;
            return false;
        }

        if (ip.AddressFamily == AddressFamily.InterNetworkV6)
        {
            if (ip.IsIPv6LinkLocal || ip.IsIPv6SiteLocal) return true;
            var b = ip.GetAddressBytes();
            // fc00::/7 unique-local
            if ((b[0] & 0xFE) == 0xFC) return true;
            return false;
        }

        return false;
    }
}
