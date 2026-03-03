namespace IabConnect.Domain.Sponsors;

public interface ISupplierRepository
{
    Task<List<Supplier>> GetAllAsync(SupplierStatus? status = null, CancellationToken ct = default);
    Task<Supplier?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<bool> CompanyNameExistsAsync(string companyName, Guid? excludeId = null, CancellationToken ct = default);
    Task AddAsync(Supplier supplier, CancellationToken ct = default);
    void Update(Supplier supplier);
    Task DeleteAsync(Guid id, CancellationToken ct = default);
}
