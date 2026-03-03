namespace IabConnect.Domain.Sponsors;

public interface ISponsorRepository
{
    Task<List<Sponsor>> GetAllAsync(SponsorStatus? status = null, CancellationToken ct = default);
    Task<Sponsor?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> CompanyNameExistsAsync(string companyName, Guid? excludeId = null, CancellationToken ct = default);
    Task AddAsync(Sponsor sponsor, CancellationToken ct = default);
    void Update(Sponsor sponsor);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
