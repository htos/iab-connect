using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

public sealed class ContactMessageRepository : IContactMessageRepository
{
    private readonly ApplicationDbContext _context;

    public ContactMessageRepository(ApplicationDbContext context) => _context = context;

    public async Task<ContactMessage?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => await _context.ContactMessages.FirstOrDefaultAsync(c => c.Id == id, ct);

    public async Task<IReadOnlyList<ContactMessage>> GetAllAsync(ContactMessageStatus? status = null, CancellationToken ct = default)
    {
        var query = _context.ContactMessages.AsQueryable();
        if (status.HasValue)
            query = query.Where(c => c.Status == status.Value);
        return await query.OrderByDescending(c => c.CreatedAt).ToListAsync(ct);
    }

    public async Task AddAsync(ContactMessage message, CancellationToken ct = default)
        => await _context.ContactMessages.AddAsync(message, ct);

    public void Update(ContactMessage message)
        => _context.ContactMessages.Update(message);

    public void Remove(ContactMessage message)
        => _context.ContactMessages.Remove(message);
}
