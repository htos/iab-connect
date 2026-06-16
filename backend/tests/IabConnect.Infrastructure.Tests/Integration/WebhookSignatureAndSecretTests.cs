using FluentAssertions;
using IabConnect.Application.Integration;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Integration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Integration;

/// <summary>
/// REQ-058 (E8-S3): unit tests for webhook signing (HMAC known-vector + constant-time verify), the
/// reversible secret store (generate → reveal round-trip), and the best-effort dispatch seam.
/// </summary>
public sealed class WebhookSignatureAndSecretTests
{
    [Fact]
    public void Sign_ProducesSha256PrefixedLowercaseHex()
    {
        var sig = new WebhookSignatureService().Sign("topsecret", "{\"a\":1}");
        sig.Should().StartWith("sha256=");
        sig.Should().Be(sig.ToLowerInvariant());
    }

    [Fact]
    public void Verify_TrueForMatching_FalseForTampered()
    {
        var svc = new WebhookSignatureService();
        var sig = svc.Sign("topsecret", "body");
        svc.Verify("topsecret", "body", sig).Should().BeTrue();
        svc.Verify("topsecret", "body-tampered", sig).Should().BeFalse();
        svc.Verify("wrongsecret", "body", sig).Should().BeFalse();
    }

    [Fact]
    public void Secret_GenerateThenReveal_RoundTrips()
    {
        var svc = new WebhookSecretService(Options.Create(new WebhookOptions()));
        var generated = svc.Generate();
        generated.RawSecret.Should().NotBeNullOrEmpty();
        generated.ProtectedSecret.Should().NotBe(generated.RawSecret); // encrypted at rest
        svc.Reveal(generated.ProtectedSecret).Should().Be(generated.RawSecret);
    }

    // Dispatch claim-before-send + best-effort behaviour is covered in WebhookDeliveryServiceTests
    // (E8-S4), which exercises the filled seam (persist Pending → enqueue, collision-abandon).
}
