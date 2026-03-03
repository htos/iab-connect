using IabConnect.Domain.Sponsors;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

public sealed class SupplierRepository : ISupplierRepository
{
    private readonly ApplicationDbContext _context;

    public SupplierRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<Supplier>> GetAllAsync(SupplierStatus? status = null, CancellationToken ct = default)
    {
        var query = _context.Suppliers
            .Include(s => s.ContractLinks)
            .AsQueryable();

        if (status.HasValue)
            query = query.Where(s => s.Status == status.Value);

        return await query.OrderBy(s => s.CompanyName).ToListAsync(ct);
    }

    public async Task<Supplier?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        return await _context.Suppliers
            .Include(s => s.ContractLinks)
            .FirstOrDefaultAsync(s => s.Id == id, ct);
    }

    public async Task<bool> CompanyNameExistsAsync(string companyName, Guid? excludeId = null, CancellationToken ct = default)
    {
        var query = _context.Suppliers.Where(s => s.CompanyName == companyName);
        if (excludeId.HasValue)
            query = query.Where(s => s.Id != excludeId.Value);
        return await query.AnyAsync(ct);
    }

    public async Task AddAsync(Supplier supplier, CancellationToken ct = default)
    {
        await _context.Suppliers.AddAsync(supplier, ct);
    }

    public void Update(Supplier supplier)
    {
        _context.Suppliers.Update(supplier);
    }

    public async Task DeleteAsync(Guid id, CancellationToken ct = default)
    {
        var supplier = await _context.Suppliers.FirstOrDefaultAsync(s => s.Id == id, ct);
        if (supplier is not null)
        {
            supplier.SoftDelete();
        }
    }
}
