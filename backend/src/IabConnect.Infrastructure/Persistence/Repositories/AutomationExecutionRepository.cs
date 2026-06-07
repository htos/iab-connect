using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>
/// REQ-028 (E5-S2): EF Core repository for automation dispatch runs + the idempotency pre-check.
/// </summary>
public sealed class AutomationExecutionRepository : IAutomationExecutionRepository
{
    private readonly ApplicationDbContext _context;

    public AutomationExecutionRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<bool> RecipientKeyExistsAsync(string idempotencyKey, CancellationToken cancellationToken = default)
        => await _context.AutomationRecipients.AnyAsync(r => r.IdempotencyKey == idempotencyKey, cancellationToken);

    public async Task<IReadOnlyCollection<string>> ExistingRecipientKeysAsync(
        IReadOnlyCollection<string> idempotencyKeys, CancellationToken cancellationToken = default)
    {
        if (idempotencyKeys.Count == 0)
            return [];

        var keys = idempotencyKeys as ICollection<string> ?? idempotencyKeys.ToList();
        return await _context.AutomationRecipients
            .Where(r => keys.Contains(r.IdempotencyKey))
            .Select(r => r.IdempotencyKey)
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(AutomationExecution execution, CancellationToken cancellationToken = default)
    {
        await _context.AutomationExecutions.AddAsync(execution, cancellationToken);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task UpdateAsync(AutomationExecution execution, CancellationToken cancellationToken = default)
    {
        _context.AutomationExecutions.Update(execution);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<IReadOnlyList<AutomationExecution>> GetRecentForDefinitionAsync(
        Guid definitionId, int limit = 10, CancellationToken cancellationToken = default)
        => await _context.AutomationExecutions
            .Where(e => e.DefinitionId == definitionId)
            .OrderByDescending(e => e.StartedAt)
            .Take(limit)
            .ToListAsync(cancellationToken);
}
