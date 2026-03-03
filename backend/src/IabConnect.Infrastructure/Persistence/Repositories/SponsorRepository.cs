using IabConnect.Domain.Sponsors;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

public sealed class SponsorRepository : ISponsorRepository
{
    private readonly ApplicationDbContext _context;

    public SponsorRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Sponsor>> GetAllAsync(SponsorStatus? status = null, CancellationToken ct = default)
    {
        var query = _context.Sponsors
            .Include(s => s.Packages)
            .Include(s => s.ContractLinks)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);

        return await query.OrderBy(s => s.CompanyName).ToListAsync(ct);
    }

    public async Task<Sponsor?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Sponsors
            .Include(s => s.Packages)
            .Include(s => s.ContractLinks)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
    }

    public async Task<bool> CompanyNameExistsAsync(string companyName, Guid? excludeId = null, CancellationToken ct = default)
    {
        var query = _context.Sponsors.Where(s => s.CompanyName == companyName);
        if (excludeId.HasValue)
            query = query.Where(s => s.Id != excludeId.Value);
        return await query.AnyAsync(ct);
    }

    public async Task AddAsync(Sponsor sponsor, CancellationToken ct = default)
    {
        await _context.Sponsors.AddAsync(sponsor, ct);
    }

    public void Update(Sponsor sponsor)
    {
        _context.Sponsors.Update(sponsor);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var sponsor = await _context.Sponsors.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (sponsor is not null)
        {
            sponsor.SoftDelete();
        }
    }
}
