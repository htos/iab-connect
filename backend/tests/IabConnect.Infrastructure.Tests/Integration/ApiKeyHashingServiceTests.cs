using FluentAssertions;
using IabConnect.Infrastructure.Integration;
using Microsoft.Extensions.Options;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Integration;

/// <summary>
/// REQ-058 (E8-S1): round-trip + tamper-rejection tests for <see cref="ApiKeyHashingService"/>.
/// Verifies the generate → verify happy path, constant-time mismatch rejection, the pepper path,
/// and prefix parsing (incl. secrets containing Base64URL '-'/'_').
/// </summary>
public sealed class ApiKeyHashingServiceTests
{
    private static ApiKeyHashingService Service(string? pepper = null) =>
        new(Options.Create(new ApiKeyOptions { ApiKeyPepper = pepper }));

    [Fact]
    public void Generate_ThenVerify_Succeeds()
    {
        var svc = Service();
        var key = svc.Generate();

        key.RawSecret.Should().StartWith("iabc.");
        key.Prefix.Should().NotBeNullOrEmpty();
        svc.Verify(key.RawSecret, key.Hash).Should().BeTrue();
    }

    [Fact]
    public void Verify_TamperedSecret_Fails()
    {
        var svc = Service();
        var key = svc.Generate();
        svc.Verify(key.RawSecret + "x", key.Hash).Should().BeFalse();
    }

    [Fact]
    public void Verify_WrongHash_Fails()
    {
        var svc = Service();
        var key = svc.Generate();
        svc.Verify(key.RawSecret, svc.Hash("iabc.deadbeef.other")).Should().BeFalse();
    }

    [Fact]
    public void Pepper_ChangesHash()
    {
        var raw = "iabc.abc123.SOMEsecretValue";
        Service().Hash(raw).Should().NotBe(Service("a-pepper").Hash(raw));
    }

    [Fact]
    public void Generate_RawSecret_RoundTripsThroughPrefixThenVerify()
    {
        var svc = Service("env-pepper");
        var key = svc.Generate();

        svc.TryParsePrefix(key.RawSecret, out var parsed).Should().BeTrue();
        parsed.Should().Be(key.Prefix);
        svc.Verify(key.RawSecret, key.Hash).Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData("garbage")]
    [InlineData("iabc.onlytwo")]
    [InlineData("other.prefix.secret")]
    public void TryParsePrefix_RejectsMalformed(string input)
    {
        Service().TryParsePrefix(input, out _).Should().BeFalse();
    }

    [Fact]
    public void TryParsePrefix_KeepsSecretWithSeparatorChars()
    {
        // Base64URL secrets contain '-'/'_' but never '.', so split(3) isolates the prefix cleanly.
        Service().TryParsePrefix("iabc.pfx.aa-bb_cc", out var prefix).Should().BeTrue();
        prefix.Should().Be("pfx");
    }
}
