namespace IabConnect.Domain.Communication;

public interface IContactMessageRepository
{
    Task<ContactMessage?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<ContactMessage>> GetAllAsync(ContactMessageStatus? status = null, CancellationToken ct = default);
    Task AddAsync(ContactMessage message, CancellationToken ct = default);
    void Update(ContactMessage message);
    void Remove(ContactMessage message);
}
