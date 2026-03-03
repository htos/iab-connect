namespace IabConnect.Domain.Blog;

public interface IBlogPostRepository
{
    Task<BlogPost?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<BlogPost?> GetBySlugAsync(string slug, CancellationToken ct = default);
    Task<IReadOnlyList<BlogPost>> GetAllAsync(BlogPostStatus? status = null, CancellationToken ct = default);
    Task<IReadOnlyList<BlogPost>> GetPublishedAsync(CancellationToken ct = default);
    Task AddAsync(BlogPost post, CancellationToken ct = default);
    void Update(BlogPost post);
    void Remove(BlogPost post);
}
