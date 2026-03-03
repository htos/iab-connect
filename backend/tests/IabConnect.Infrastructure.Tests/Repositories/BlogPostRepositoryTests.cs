using FluentAssertions;
using IabConnect.Domain.Blog;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// Integration tests for BlogPostRepository using Testcontainers
/// REQ-047: News/Blog
/// </summary>
public class BlogPostRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgresContainer = null!;
    private ApplicationDbContext _context = null!;
    private BlogPostRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgresContainer = new PostgreSqlBuilder("postgres:18")
            .Build();

        await _postgresContainer.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgresContainer.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);

        _repository = new BlogPostRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgresContainer.DisposeAsync();
    }

    #region AddAsync Tests

    [Fact]
    public async Task AddAsync_NewBlogPost_ShouldPersist()
    {
        // Arrange
        var post = CreateTestPost();

        // Act
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var retrieved = await _repository.GetByIdAsync(post.Id, TestContext.Current.CancellationToken);
        retrieved.Should().NotBeNull();
        retrieved!.Title.Should().Be("Test Blog Post");
        retrieved.Author.Should().Be("Admin User");
        retrieved.Status.Should().Be(BlogPostStatus.Draft);
    }

    [Fact]
    public async Task AddAsync_BlogPostWithTags_ShouldPersistTags()
    {
        // Arrange
        var post = BlogPost.Create("Tagged Post", "Content", null, "Author", "General",
            new List<string> { "culture", "events", "india" }, null, Guid.NewGuid());

        // Act
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        _context.ChangeTracker.Clear();
        var retrieved = await _repository.GetByIdAsync(post.Id, TestContext.Current.CancellationToken);
        retrieved!.Tags.Should().HaveCount(3);
        retrieved.Tags.Should().Contain("culture");
        retrieved.Tags.Should().Contain("events");
        retrieved.Tags.Should().Contain("india");
    }

    #endregion

    #region GetByIdAsync Tests

    [Fact]
    public async Task GetByIdAsync_ExistingId_ShouldReturnPost()
    {
        // Arrange
        var post = CreateTestPost();
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetByIdAsync(post.Id, TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Id.Should().Be(post.Id);
    }

    [Fact]
    public async Task GetByIdAsync_NonExistingId_ShouldReturnNull()
    {
        // Act
        var result = await _repository.GetByIdAsync(Guid.NewGuid(), TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetBySlugAsync Tests

    [Fact]
    public async Task GetBySlugAsync_ExistingSlug_ShouldReturnPost()
    {
        // Arrange
        var post = CreateTestPost();
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetBySlugAsync("test-blog-post", TestContext.Current.CancellationToken);

        // Assert
        result.Should().NotBeNull();
        result!.Title.Should().Be("Test Blog Post");
    }

    [Fact]
    public async Task GetBySlugAsync_NonExistingSlug_ShouldReturnNull()
    {
        // Act
        var result = await _repository.GetBySlugAsync("does-not-exist", TestContext.Current.CancellationToken);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region GetAllAsync Tests

    [Fact]
    public async Task GetAllAsync_NoFilter_ShouldReturnAll()
    {
        // Arrange
        var post1 = BlogPost.Create("Post A", "Content A", null, "Author", "General", null, null, Guid.NewGuid());
        var post2 = BlogPost.Create("Post B", "Content B", null, "Author", "Culture", null, null, Guid.NewGuid());
        await _repository.AddAsync(post1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(post2, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(ct: TestContext.Current.CancellationToken);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllAsync_WithStatusFilter_ShouldReturnFiltered()
    {
        // Arrange
        var draft = BlogPost.Create("Draft Post", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        var published = BlogPost.Create("Published Post", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        published.Publish(Guid.NewGuid());

        await _repository.AddAsync(draft, TestContext.Current.CancellationToken);
        await _repository.AddAsync(published, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetAllAsync(BlogPostStatus.Published, TestContext.Current.CancellationToken);

        // Assert
        result.Should().ContainSingle()
            .Which.Title.Should().Be("Published Post");
    }

    #endregion

    #region GetPublishedAsync Tests

    [Fact]
    public async Task GetPublishedAsync_ShouldReturnOnlyPublishedPosts()
    {
        // Arrange
        var draft = BlogPost.Create("Draft", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        var published1 = BlogPost.Create("Published 1", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        published1.Publish(Guid.NewGuid());
        var published2 = BlogPost.Create("Published 2", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        published2.Publish(Guid.NewGuid());
        var archived = BlogPost.Create("Archived", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        archived.Archive(Guid.NewGuid());

        await _repository.AddAsync(draft, TestContext.Current.CancellationToken);
        await _repository.AddAsync(published1, TestContext.Current.CancellationToken);
        await _repository.AddAsync(published2, TestContext.Current.CancellationToken);
        await _repository.AddAsync(archived, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetPublishedAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(p => p.Status == BlogPostStatus.Published);
    }

    [Fact]
    public async Task GetPublishedAsync_ShouldOrderByPublishedAtDescending()
    {
        // Arrange
        var first = BlogPost.Create("First Published", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        first.Publish(Guid.NewGuid());
        await _repository.AddAsync(first, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Small delay to ensure different PublishedAt
        await Task.Delay(50, TestContext.Current.CancellationToken);

        var second = BlogPost.Create("Second Published", "Content", null, "Author", "General", null, null, Guid.NewGuid());
        second.Publish(Guid.NewGuid());
        await _repository.AddAsync(second, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        var result = await _repository.GetPublishedAsync(TestContext.Current.CancellationToken);

        // Assert
        result.Should().HaveCount(2);
        result[0].Title.Should().Be("Second Published");
        result[1].Title.Should().Be("First Published");
    }

    #endregion

    #region Update Tests

    [Fact]
    public async Task Update_ExistingPost_ShouldPersistChanges()
    {
        // Arrange
        var post = CreateTestPost();
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        post.Update("Updated Title", "Updated content", "Updated excerpt", "New Author", "Culture",
            new List<string> { "updated" }, "http://new-image.jpg", Guid.NewGuid());
        _repository.Update(post);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        _context.ChangeTracker.Clear();
        var retrieved = await _repository.GetByIdAsync(post.Id, TestContext.Current.CancellationToken);
        retrieved!.Title.Should().Be("Updated Title");
        retrieved.Slug.Should().Be("updated-title");
        retrieved.Content.Should().Be("Updated content");
        retrieved.Category.Should().Be("Culture");
    }

    [Fact]
    public async Task Update_PublishPost_ShouldPersistPublishedStatus()
    {
        // Arrange
        var post = CreateTestPost();
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        post.Publish(Guid.NewGuid());
        _repository.Update(post);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        _context.ChangeTracker.Clear();
        var retrieved = await _repository.GetByIdAsync(post.Id, TestContext.Current.CancellationToken);
        retrieved!.Status.Should().Be(BlogPostStatus.Published);
        retrieved.PublishedAt.Should().NotBeNull();
    }

    #endregion

    #region Remove Tests

    [Fact]
    public async Task Remove_ExistingPost_ShouldDelete()
    {
        // Arrange
        var post = CreateTestPost();
        await _repository.AddAsync(post, TestContext.Current.CancellationToken);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Act
        _repository.Remove(post);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        // Assert
        var result = await _repository.GetByIdAsync(post.Id, TestContext.Current.CancellationToken);
        result.Should().BeNull();
    }

    #endregion

    #region Helpers

    private static BlogPost CreateTestPost() =>
        BlogPost.Create(
            "Test Blog Post",
            "This is the content of the test blog post.",
            "A short excerpt for testing.",
            "Admin User",
            "General",
            new List<string> { "test", "blog" },
            null,
            Guid.NewGuid());

    #endregion
}
