using FluentAssertions;
using IabConnect.Application.Events.CheckIn;
using Xunit;

namespace IabConnect.Application.Tests.Events.CheckIn;

/// <summary>
/// REQ-023 (E3.S2) AC-8 + action item A8: adversarial-input coverage for the manual-search
/// hash that lands in <c>LogAccessGranted.additionalData["searchQueryHash"]</c>.
/// </summary>
public sealed class CheckInSearchHasherTests
{
    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\n")]
    public void Hash_ReturnsEmpty_ForNullOrWhitespaceInput(string? input)
    {
        CheckInSearchHasher.Hash(input).Should().BeEmpty();
    }

    [Theory]
    [InlineData("Anna")]
    [InlineData("a%b")]        // LIKE-pattern chars MUST NOT crash the hasher (we never LIKE the hash)
    [InlineData("Müller")] // German umlaut (precomposed)
    [InlineData("Renée")]
    [InlineData("100%")]
    [InlineData("O'Brien")]
    public void Hash_ReturnsStable16CharBase64Prefix_ForNonEmptyInput(string input)
    {
        var first = CheckInSearchHasher.Hash(input);
        var second = CheckInSearchHasher.Hash(input);

        first.Should().NotBeEmpty();
        first.Should().HaveLength(CheckInSearchHasher.PrefixLength);
        first.Should().Be(second, "hashing must be deterministic for audit forensics");
        // R3-M-S2-3: base64url alphabet — `+` → `-`, `/` → `_`. Standard base64 chars are now
        // forbidden in the output. The prefix excludes padding.
        first.Should().MatchRegex("^[A-Za-z0-9_-]+$");
        first.Should().NotContain("+");
        first.Should().NotContain("/");
    }

    [Fact]
    public void Hash_TrimsLeadingAndTrailingWhitespace()
    {
        // Same trimmed core -> same hash.
        var spaced = CheckInSearchHasher.Hash("  Anna  ");
        var plain = CheckInSearchHasher.Hash("Anna");

        spaced.Should().Be(plain);
    }

    [Fact]
    public void Hash_DifferentInputs_ProduceDifferentHashes()
    {
        var a = CheckInSearchHasher.Hash("Anna");
        var b = CheckInSearchHasher.Hash("Berta");

        a.Should().NotBe(b);
    }

    [Fact]
    public void Hash_UnicodeNormalisationForms_ProduceDifferentHashes()
    {
        // Precomposed U+00FC ("u with diaeresis") vs decomposed "u" + U+0308 combining diaeresis.
        // The hasher does NOT normalise — this is intentional per story D4. The test asserts the
        // expected inequality so a future "let's NFC-normalise the input" change has to update
        // this test explicitly rather than silently changing audit semantics.
        const string precomposed = "Müller";        // M + U+00FC + ller
        const string decomposed = "Müller";        // M + u + U+0308 + ller

        var a = CheckInSearchHasher.Hash(precomposed);
        var b = CheckInSearchHasher.Hash(decomposed);

        a.Should().NotBeEmpty();
        b.Should().NotBeEmpty();
        a.Should().NotBe(b);
    }

    [Fact]
    public void Hash_NeverContainsRawInput()
    {
        const string raw = "JohannSmith42";
        var hash = CheckInSearchHasher.Hash(raw);

        hash.Should().NotContain(raw);
        hash.Should().NotContain("Johann");
        hash.Should().NotContain("Smith");
    }
}
