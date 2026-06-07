using FluentAssertions;
using IabConnect.Domain.Blog;
using IabConnect.Domain.Common;
using IabConnect.Domain.Events;
using Xunit;

namespace IabConnect.Application.Tests;

/// <summary>
/// REQ-055 (E7-S4): content-language metadata on Event + BlogPost.
/// Validates the shared <see cref="ContentLanguages"/> normalizer and the
/// per-entity <c>SetContentLanguage</c> write boundary (DEC-2 = nullable string,
/// DEC-3 = constrained to de/en/hi + null).
/// </summary>
public class ContentLanguageTests
{
    #region ContentLanguages.Normalize

    [Theory]
    [InlineData("de", "de")]
    [InlineData("en", "en")]
    [InlineData("hi", "hi")]
    [InlineData("DE", "de")]
    [InlineData(" En ", "en")]
    public void Normalize_SupportedCode_ReturnsLowercasedTrimmed(string input, string expected)
    {
        ContentLanguages.Normalize(input).Should().Be(expected);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Normalize_NullOrWhitespace_ReturnsNull(string? input)
    {
        ContentLanguages.Normalize(input).Should().BeNull();
    }

    [Theory]
    [InlineData("fr")]
    [InlineData("xx")]
    [InlineData("english")]
    [InlineData("de-CH")]
    public void Normalize_UnsupportedCode_Throws(string input)
    {
        var act = () => ContentLanguages.Normalize(input);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Supported_ContainsExactlyDeEnHi()
    {
        ContentLanguages.Supported.Should().BeEquivalentTo(new[] { "de", "en", "hi" });
    }

    #endregion

    #region Event.SetContentLanguage

    [Fact]
    public void Event_SetContentLanguage_Supported_StoresNormalizedValue()
    {
        var evt = CreateEvent();
        evt.SetContentLanguage("HI");
        evt.ContentLanguage.Should().Be("hi");
    }

    [Fact]
    public void Event_SetContentLanguage_Null_ClearsToNull()
    {
        var evt = CreateEvent();
        evt.SetContentLanguage("de");
        evt.SetContentLanguage(null);
        evt.ContentLanguage.Should().BeNull();
    }

    [Fact]
    public void Event_NewEvent_HasNullContentLanguageByDefault()
    {
        CreateEvent().ContentLanguage.Should().BeNull();
    }

    [Fact]
    public void Event_SetContentLanguage_Unsupported_Throws()
    {
        var evt = CreateEvent();
        var act = () => evt.SetContentLanguage("fr");
        act.Should().Throw<ArgumentException>();
    }

    #endregion

    #region BlogPost.SetContentLanguage

    [Fact]
    public void BlogPost_SetContentLanguage_Supported_StoresNormalizedValue()
    {
        var post = CreateBlogPost();
        post.SetContentLanguage("EN");
        post.ContentLanguage.Should().Be("en");
    }

    [Fact]
    public void BlogPost_NewPost_HasNullContentLanguageByDefault()
    {
        CreateBlogPost().ContentLanguage.Should().BeNull();
    }

    [Fact]
    public void BlogPost_SetContentLanguage_Unsupported_Throws()
    {
        var post = CreateBlogPost();
        var act = () => post.SetContentLanguage("zz");
        act.Should().Throw<ArgumentException>();
    }

    #endregion

    private static Event CreateEvent() =>
        Event.Create("Title", "Description", "Location", DateTime.UtcNow, DateTime.UtcNow.AddHours(1));

    private static BlogPost CreateBlogPost() =>
        BlogPost.Create("Title", "Content body", null, "Author", "General", null, null, Guid.NewGuid());
}
