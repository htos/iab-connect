using FluentAssertions;
using IabConnect.Application.Common;
using Xunit;

namespace IabConnect.Application.Tests.Common;

/// <summary>
/// REQ-018 / REQ-023: Unit tests for the shared <see cref="TextNormalization"/> helper
/// that backs duplicate-matching name folds and event-roster name sorting.
/// Mirrors the matcher-level coverage so that any regression in the underlying
/// implementation is caught here regardless of caller.
/// </summary>
public sealed class TextNormalizationTests
{
    [Theory]
    [InlineData("Müller", "mueller")]
    [InlineData("MÜLLER", "mueller")]
    [InlineData("Strässer", "straesser")]
    [InlineData("Mueller", "mueller")]
    [InlineData("  Ä  ", "ae")]
    [InlineData("ß", "ss")]
    [InlineData("Renée", "renee")]
    [InlineData("Émile", "emile")]
    [InlineData("Maria", "maria")]
    public void FoldName_ProducesExpectedFold(string input, string expected)
    {
        TextNormalization.FoldName(input).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData("\t\r\n")]
    public void FoldName_NullOrWhitespace_ReturnsEmpty(string? input)
    {
        TextNormalization.FoldName(input).Should().BeEmpty();
    }

    [Theory]
    [InlineData("Anna", "Berta")]
    [InlineData("Müller", "Schmidt")]
    [InlineData("Renée", "Renate")]
    public void FoldName_DifferentNames_FoldDifferently(string a, string b)
    {
        TextNormalization.FoldName(a).Should().NotBe(TextNormalization.FoldName(b));
    }

    [Theory]
    [InlineData("Müller", "Mueller")]
    [InlineData("MÜLLER", "Mueller")]
    [InlineData("Renée", "Renee")]
    [InlineData("  Müller  ", "mueller")]
    [InlineData("Strässer", "Straesser")]
    public void FoldName_EquivalentSpellings_FoldToSameValue(string a, string b)
    {
        TextNormalization.FoldName(a).Should().Be(TextNormalization.FoldName(b));
    }
}
