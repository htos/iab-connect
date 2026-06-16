using IabConnect.Domain.Integration;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-058 (E8-S1): EF Core repository for <see cref="ApiClient"/>. <see cref="AddAsync"/> and
/// <see cref="UpdateAsync"/> own their <c>SaveChangesAsync</c>, mirroring the automation repository.
/// </summary>
public sealed class ApiClientRepository : IApiClientRepository
{
    private readonly ApplicationDbContext _context;

    public ApiClientRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<ApiClient?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
        => await _context.ApiClients.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);

    public async Task<ApiClient?> GetByPrefixAsync(string secretPrefix, CancellationToken cancellationToken = default)
        => await _context.ApiClients.FirstOrDefaultAsync(c => c.SecretPrefix == secretPrefix, cancellationToken);

    public async Task<IReadOnlyList<ApiClient>> GetAllAsync(CancellationToken cancellationToken = default)
        => await _context.ApiClients
            .OrderByDescending(c => c.CreatedAt)
            .ToListAsync(cancellationToken);

    public async Task AddAsync(ApiClient client, CancellationToken cancellationToken = default)
    {
        await _context.ApiClients.AddAsync(client, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(ApiClient client, CancellationToken cancellationToken = default)
    {
        _context.ApiClients.Update(client);
        await _context.SaveChangesAsync(cancellationToken);
    }
}
