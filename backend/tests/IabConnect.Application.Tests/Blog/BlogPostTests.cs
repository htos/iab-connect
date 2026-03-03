using FluentAssertions;
using IabConnect.Domain.Blog;
using Xunit;

namespace IabConnect.Application.Tests.Blog;

/// <summary>
/// Unit tests for BlogPost entity
/// REQ-047: News/Blog
/// </summary>
public class BlogPostTests
{
    #region Create Tests

    [Fact]
    public void Create_ValidInput_ShouldSetAllProperties()
    {
        var userId = Guid.NewGuid();
        var post = BlogPost.Create("Test Title", "Test content here", "Short excerpt", "Author Name", "General", new List<string> { "tag1", "tag2" }, null, userId);

        post.Title.Should().Be("Test Title");
        post.Content.Should().Be("Test content here");
        post.Excerpt.Should().Be("Short excerpt");
        post.Author.Should().Be("Author Name");
        post.Category.Should().Be("General");
        post.Tags.Should().BeEquivalentTo(new[] { "tag1", "tag2" });
    }

    [Fact]
    public void Create_ShouldGenerateSlug()
    {
        var post = BlogPost.Create("Hello World Post", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        post.Slug.Should().Be("hello-world-post");
    }

    [Fact]
    public void Create_WithGermanChars_ShouldTransliterateSlug()
    {
        var post = BlogPost.Create("Über Ähnliche Öffnungen", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        post.Slug.Should().Be("ueber-aehnliche-oeffnungen");
    }

    [Fact]
    public void Create_NewPost_ShouldSetStatusToDraft()
    {
        var post = CreateTestPost();
        post.Status.Should().Be(BlogPostStatus.Draft);
    }

    [Fact]
    public void Create_NewPost_ShouldGenerateId()
    {
        var post = CreateTestPost();
        post.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_NewPost_ShouldNotBePublished()
    {
        var post = CreateTestPost();
        post.PublishedAt.Should().BeNull();
    }

    [Theory]
    [InlineData("", "Content", "Author")]
    [InlineData("Title", "", "Author")]
    [InlineData("Title", "Content", "")]
    [InlineData(null, "Content", "Author")]
    public void Create_WithMissingRequiredFields_ShouldThrowArgumentException(string? title, string content, string author)
    {
        var act = () => BlogPost.Create(title!, content, null, author, "General", null, null, Guid.NewGuid());
        act.Should().Throw<ArgumentException>();
    }

    #endregion

    #region Publish Tests

    [Fact]
    public void Publish_DraftPost_ShouldSetStatusToPublished()
    {
        var post = CreateTestPost();
        post.Publish(Guid.NewGuid());
        post.Status.Should().Be(BlogPostStatus.Published);
    }

    [Fact]
    public void Publish_DraftPost_ShouldSetPublishedAt()
    {
        var post = CreateTestPost();
        post.Publish(Guid.NewGuid());
        post.PublishedAt.Should().NotBeNull();
        post.PublishedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Publish_AlreadyPublished_ShouldNotChangePublishedAt()
    {
        var post = CreateTestPost();
        post.Publish(Guid.NewGuid());
        var firstPublished = post.PublishedAt;

        // Publish again
        post.Publish(Guid.NewGuid());
        post.PublishedAt.Should().Be(firstPublished);
    }

    #endregion

    #region Unpublish Tests

    [Fact]
    public void Unpublish_PublishedPost_ShouldSetStatusToDraft()
    {
        var post = CreateTestPost();
        post.Publish(Guid.NewGuid());
        post.Unpublish(Guid.NewGuid());
        post.Status.Should().Be(BlogPostStatus.Draft);
    }

    #endregion

    #region Archive Tests

    [Fact]
    public void Archive_Post_ShouldSetStatusToArchived()
    {
        var post = CreateTestPost();
        post.Archive(Guid.NewGuid());
        post.Status.Should().Be(BlogPostStatus.Archived);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldUpdateAllProperties()
    {
        var post = CreateTestPost();
        post.Update("New Title", "New Content", "New Excerpt", "New Author", "Culture", new List<string> { "new" }, "http://img.jpg", Guid.NewGuid());

        post.Title.Should().Be("New Title");
        post.Content.Should().Be("New Content");
        post.Excerpt.Should().Be("New Excerpt");
        post.Author.Should().Be("New Author");
        post.Category.Should().Be("Culture");
        post.Tags.Should().ContainSingle("new");
        post.ImageUrl.Should().Be("http://img.jpg");
    }

    [Fact]
    public void Update_ShouldRegenerateSlug()
    {
        var post = CreateTestPost();
        post.Update("Completely New Title", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        post.Slug.Should().Be("completely-new-title");
    }

    #endregion

    #region Helpers

    private static BlogPost CreateTestPost() =>
        BlogPost.Create("Test Post", "Test content body", "Short excerpt", "Test Author", "General", new List<string> { "test" }, null, Guid.NewGuid());

    #endregion
}
