using IabConnect.Domain.Common;

namespace IabConnect.Domain.Blog;

/// <summary>
/// REQ-047: Blog/News post for public website
/// </summary>
public sealed class BlogPost : AggregateRoot
{
    public string Title { get; private set; } = null!;
    public string Slug { get; private set; } = null!;
    public string Content { get; private set; } = null!;
    public string? Excerpt { get; private set; }
    public string Author { get; private set; } = null!;
    public string Category { get; private set; } = null!;
    public List<string> Tags { get; private set; } = [];
    public string? ImageUrl { get; private set; }
    public BlogPostStatus Status { get; private set; }
    public DateTime? PublishedAt { get; private set; }

    private BlogPost() : base() { }

    public static BlogPost Create(
        string title,
        string content,
        string? excerpt,
        string author,
        string category,
        List<string>? tags,
        string? imageUrl,
        Guid createdBy)
    {
        if (string.IsNullOrWhiteSpace(title)) throw new ArgumentException("Title is required");
        if (string.IsNullOrWhiteSpace(content)) throw new ArgumentException("Content is required");
        if (string.IsNullOrWhiteSpace(author)) throw new ArgumentException("Author is required");

        var post = new BlogPost
        {
            Title = title.Trim(),
            Slug = GenerateSlug(title),
            Content = content,
            Excerpt = excerpt?.Trim(),
            Author = author.Trim(),
            Category = category?.Trim() ?? "General",
            Tags = tags ?? [],
            ImageUrl = imageUrl,
            Status = BlogPostStatus.Draft
        };
        post.SetCreatedBy(createdBy);
        return post;
    }

    public void Update(string title, string content, string? excerpt, string author, string category, List<string>? tags, string? imageUrl, Guid updatedBy)
    {
        Title = title.Trim();
        Slug = GenerateSlug(title);
        Content = content;
        Excerpt = excerpt?.Trim();
        Author = author.Trim();
        Category = category?.Trim() ?? "General";
        Tags = tags ?? [];
        ImageUrl = imageUrl;
        SetUpdated(updatedBy);
    }

    public void Publish(Guid userId)
    {
        if (Status == BlogPostStatus.Published) return;
        Status = BlogPostStatus.Published;
        PublishedAt = DateTime.UtcNow;
        SetUpdated(userId);
    }

    public void Unpublish(Guid userId)
    {
        Status = BlogPostStatus.Draft;
        SetUpdated(userId);
    }

    public void Archive(Guid userId)
    {
        Status = BlogPostStatus.Archived;
        SetUpdated(userId);
    }

    private static string GenerateSlug(string title)
    {
        var slug = title.ToLowerInvariant()
            .Replace("ä", "ae").Replace("ö", "oe").Replace("ü", "ue").Replace("ß", "ss")
            .Replace(" ", "-");
        // Remove non-alphanumeric chars except hyphens
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"[^a-z0-9\-]", "");
        slug = System.Text.RegularExpressions.Regex.Replace(slug, @"-+", "-").Trim('-');
        return slug;
    }
}

public enum BlogPostStatus
{
    Draft,
    Published,
    Archived
}
