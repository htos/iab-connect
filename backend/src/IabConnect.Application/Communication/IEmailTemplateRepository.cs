namespace IabConnect.Application.Communication;

using IabConnect.Domain.Communication;

public interface IEmailTemplateRepository
{
    Task<EmailTemplate?> GetByIdAsync(int id);
    Task<EmailTemplate?> GetByNameAsync(string name);
    Task<List<EmailTemplate>> GetAllAsync(bool activeOnly = true);
    Task<List<EmailTemplate>> GetByCategoryAsync(string category);
    Task<List<EmailTemplate>> SearchAsync(string searchTerm);
    Task<EmailTemplate> AddAsync(EmailTemplate template);
    Task UpdateAsync(EmailTemplate template);
    Task DeleteAsync(int id);
    Task<int> CountAsync();
}
