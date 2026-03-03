using IabConnect.Domain.Blog;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

public sealed class BlogPostRepository : IBlogPostRepository
{
    private readonly ApplicationDbContext _context;

    public BlogPostRepository(ApplicationDbContext context) => _context = context;

    public async Task<BlogPost?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _context.BlogPosts.FirstOrDefaultAsync(b => b.Id == id, ct);

    public async Task<BlogPost?> GetBySlugAsync(string slug, CancellationToken ct = default)
        => await _context.BlogPosts.FirstOrDefaultAsync(b => b.Slug == slug, ct);

    public async Task<IReadOnlyList<BlogPost>> GetAllAsync(BlogPostStatus? status = null, CancellationToken ct = default)
    {
        var query = _context.BlogPosts.AsQueryable();
        if (status.HasValue)
            query = query.Where(b => b.Status == status.Value);
        return await query.OrderByDescending(b => b.CreatedAt).ToListAsync(ct);
    }

    public async Task<IReadOnlyList<BlogPost>> GetPublishedAsync(CancellationToken ct = default)
        => await _context.BlogPosts
            .Where(b => b.Status == BlogPostStatus.Published)
            .OrderByDescending(b => b.PublishedAt)
            .ToListAsync(ct);

    public async Task AddAsync(BlogPost post, CancellationToken ct = default)
        => await _context.BlogPosts.AddAsync(post, ct);

    public void Update(BlogPost post)
        => _context.BlogPosts.Update(post);

    public void Remove(BlogPost post)
        => _context.BlogPosts.Remove(post);
}
