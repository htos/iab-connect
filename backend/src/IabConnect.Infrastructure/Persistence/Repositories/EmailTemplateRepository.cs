namespace IabConnect.Infrastructure.Persistence.Repositories;

using IabConnect.Application.Communication;
using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

public class EmailTemplateRepository : IEmailTemplateRepository
{
    private readonly ApplicationDbContext _context;

    public EmailTemplateRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<EmailTemplate?> GetByIdAsync(int id)
    {
        return await _context.EmailTemplates
            .Include(e => e.Variables)
            .FirstOrDefaultAsync(e => e.Id == id);
    }

    public async Task<EmailTemplate?> GetByNameAsync(string name)
    {
        return await _context.EmailTemplates
            .Include(e => e.Variables)
            .FirstOrDefaultAsync(e => e.Name == name);
    }

    public async Task<List<EmailTemplate>> GetAllAsync(bool activeOnly = true)
    {
        var query = _context.EmailTemplates.AsQueryable();

        if (activeOnly)
            query = query.Where(e => e.IsActive);

        return await query.OrderBy(e => e.Category).ThenBy(e => e.Name).ToListAsync();
    }

    public async Task<List<EmailTemplate>> GetByCategoryAsync(string category)
    {
        return await _context.EmailTemplates
            .Where(e => e.Category == category && e.IsActive)
            .OrderBy(e => e.Name)
            .ToListAsync();
    }

    public async Task<List<EmailTemplate>> SearchAsync(string searchTerm)
    {
        return await _context.EmailTemplates
            .Where(e => e.IsActive &&
                   (e.Name.Contains(searchTerm) ||
                    e.Description.Contains(searchTerm) ||
                    e.Category.Contains(searchTerm)))
            .OrderBy(e => e.Name)
            .ToListAsync();
    }

    public async Task<EmailTemplate> AddAsync(EmailTemplate template)
    {
        _context.EmailTemplates.Add(template);
        await _context.SaveChangesAsync();
        return template;
    }

    public async Task UpdateAsync(EmailTemplate template)
    {
        _context.EmailTemplates.Update(template);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(int id)
    {
        var template = await GetByIdAsync(id);
        if (template != null)
        {
            _context.EmailTemplates.Remove(template);
            await _context.SaveChangesAsync();
        }
    }

    public async Task<int> CountAsync()
    {
        return await _context.EmailTemplates.CountAsync();
    }
}
