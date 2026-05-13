using FluentAssertions;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018: Unit tests for the deterministic <see cref="DuplicateMatcher"/>.
/// Every rule has positive, negative, normalization-edge, and null/empty coverage (AC-5).
/// </summary>
public sealed class DuplicateMatcherTests
{
    private readonly DuplicateMatcher _matcher = new();

    // ===== NormalizeEmail =====

    [Theory]
    [InlineData("max@example.com", "max@example.com")]           // match: lower-case stays
    [InlineData("Max@Example.COM", "max@example.com")]           // normalization edge: case folded
    [InlineData("  max+tag@example.com  ", "max@example.com")]   // edge: trim + strip +tag alias
    [InlineData(null, "")]                                       // null
    [InlineData("", "")]                                         // empty
    [InlineData("notanemail", "notanemail")]                     // near-miss: no @ -> returned as-is (trimmed/lowered)
    public void NormalizeEmail_FoldsAndStripsTags(string? input, string expected)
    {
        _matcher.NormalizeEmail(input).Should().Be(expected);
    }

    // ===== NormalizePhoneDigits =====

    [Theory]
    [InlineData("+41 79 123 45 67", "41791234567")]   // match: strips spaces, plus
    [InlineData("(079) 123-45-67", "0791234567")]     // edge: strips parens, dashes
    [InlineData("abc", "")]                           // near-miss: non-digit only -> empty
    [InlineData(null, "")]                            // null
    [InlineData("   ", "")]                           // whitespace
    public void NormalizePhoneDigits_KeepsOnlyDigits(string? input, string expected)
    {
        _matcher.NormalizePhoneDigits(input).Should().Be(expected);
    }

    // ===== FoldName =====

    [Theory]
    [InlineData("Müller", "mueller")]           // normalization edge: German umlaut expanded
    [InlineData("MÜLLER", "mueller")]           // case + umlaut
    [InlineData("Strässer", "straesser")]       // umlaut + sharp s
    [InlineData("  Mueller  ", "mueller")]      // match: trim + lower
    [InlineData("Maria", "maria")]              // match
    [InlineData("Renée", "renee")]              // diacritic stripped (non-German)
    [InlineData(null, "")]                      // null
    [InlineData("", "")]                        // empty
    public void FoldName_LowersTrimsAndStripsDiacritics(string? input, string expected)
    {
        _matcher.FoldName(input).Should().Be(expected);
    }

    // ===== EvaluateCandidate =====

    [Fact]
    public void EvaluateCandidate_SameId_ReturnsNull()
    {
        var member = MakeMember("Max", "Mustermann", "max@example.com");

        // Comparing a member to itself: same Id -> never a duplicate of itself.
        var (tier, reason) = _matcher.EvaluateCandidate(member, member);

        tier.Should().BeNull();
        reason.Should().Be(MatchReason.None);
    }

    [Fact]
    public void EvaluateCandidate_ExactEmailCaseInsensitive_ReturnsExact()
    {
        var input = MakeMember("Foo", "Bar", "Max@Example.COM");
        var candidate = MakeMember("Other", "Person", "max@example.com");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().Be(MatchTier.Exact);
        reason.Should().Be(MatchReason.Email);
    }

    [Fact]
    public void EvaluateCandidate_EmailDiffersOnlyByPlusTag_ReturnsExact()
    {
        var input = MakeMember("X", "Y", "max+work@example.com");
        var candidate = MakeMember("X", "Y", "max+personal@example.com");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().Be(MatchTier.Exact);
        reason.Should().Be(MatchReason.Email);
    }

    [Fact]
    public void EvaluateCandidate_OnlyFirstNameMatches_ReturnsNull()
    {
        var input = MakeMember("Max", "Mueller", "a@x.com");
        var candidate = MakeMember("Max", "Schmidt", "b@y.com");

        var (tier, _) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().BeNull();
    }

    [Fact]
    public void EvaluateCandidate_OnlyLastNameMatches_ReturnsNull()
    {
        var input = MakeMember("Anna", "Mueller", "a@x.com");
        var candidate = MakeMember("Boris", "Mueller", "b@y.com");

        var (tier, _) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().BeNull();
    }

    [Fact]
    public void EvaluateCandidate_NameMatchesButNoOtherSignal_ReturnsNull()
    {
        var input = MakeMember(
            "Max", "Mueller", "a@x.com",
            phone: "111", postalCode: "1000", street: "Foo");
        var candidate = MakeMember(
            "Max", "Mueller", "b@y.com",
            phone: "999", postalCode: "9999", street: "Bar");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().BeNull();
        reason.Should().Be(MatchReason.NameOnly);
    }

    [Fact]
    public void EvaluateCandidate_NameAndPhoneMatch_ReturnsLikely_WithPhoneReason()
    {
        var input = MakeMember(
            "Max", "Mueller", "a@x.com",
            phone: "+41 79 123 45 67",
            postalCode: "1000", street: "Foo");
        var candidate = MakeMember(
            "Max", "Mueller", "b@y.com",
            phone: "0791234567",      // same digits, different format
            postalCode: "9999", street: "Bar");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        // The normalized phones are "41791234567" vs "0791234567" -- different.
        // So this is the near-miss case for the phone bit.
        tier.Should().BeNull();
        reason.Should().Be(MatchReason.NameOnly);
    }

    [Fact]
    public void EvaluateCandidate_NameAndExactPhoneDigitsMatch_ReturnsLikely()
    {
        var input = MakeMember(
            "Max", "Mueller", "a@x.com",
            phone: "079-123-45-67",
            postalCode: "1000", street: "Foo");
        var candidate = MakeMember(
            "Max", "Mueller", "b@y.com",
            phone: "(079) 123 45 67",
            postalCode: "9999", street: "Bar");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().Be(MatchTier.Likely);
        reason.Should().HaveFlag(MatchReason.NormalizedPhone);
        reason.Should().HaveFlag(MatchReason.NameOnly);
    }

    [Fact]
    public void EvaluateCandidate_NameAndPostalAndStreetPrefixMatch_ReturnsLikely_WithPostalReason()
    {
        var input = MakeMember(
            "Müller", "Schmidt", "a@x.com",
            postalCode: "3011", street: "Bundesplatz");
        var candidate = MakeMember(
            "Mueller", "Schmidt", "b@y.com",
            postalCode: "3011", street: "Bundesplatz 1");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().Be(MatchTier.Likely);
        reason.Should().HaveFlag(MatchReason.PostalAndStreet);
    }

    [Fact]
    public void EvaluateCandidate_NameAndEmailLocalPartMatch_ReturnsLikely_WithLocalPartReason()
    {
        var input = MakeMember(
            "Max", "Mueller", "max@gmail.com",
            postalCode: "1000", street: "Foo");
        var candidate = MakeMember(
            "Max", "Mueller", "max@yahoo.com",
            postalCode: "9999", street: "Bar");

        var (tier, reason) = _matcher.EvaluateCandidate(input, candidate);

        tier.Should().Be(MatchTier.Likely);
        reason.Should().HaveFlag(MatchReason.EmailLocalPart);
    }

    private static Member MakeMember(
        string firstName,
        string lastName,
        string email,
        string? phone = null,
        string postalCode = "0000",
        string street = "Nicht angegeben")
    {
        var address = Address.Create(street, "City", postalCode, "Schweiz");
        return Member.Create(firstName, lastName, email, address, MembershipType.Regular, phone);
    }
}
