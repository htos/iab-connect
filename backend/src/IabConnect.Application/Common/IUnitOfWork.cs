namespace IabConnect.Application.Common;

/// <summary>
/// Unit of Work abstraction for Application layer handlers
/// </summary>
public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
