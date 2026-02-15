namespace IabConnect.Infrastructure.Persistence;

/// <summary>
/// Unit of Work interface (infrastructure-level, kept for backward compatibility)
/// </summary>
public interface IUnitOfWork : IabConnect.Application.Common.IUnitOfWork
{
}

/// <summary>
/// Unit of Work implementation
/// </summary>
public sealed class UnitOfWork : IUnitOfWork
{
    private readonly ApplicationDbContext _context;

    public UnitOfWork(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        return await _context.SaveChangesAsync(cancellationToken);
    }
}
