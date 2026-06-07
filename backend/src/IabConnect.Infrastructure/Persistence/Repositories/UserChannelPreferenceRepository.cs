using IabConnect.Domain.Communication;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence.Repositories;

/// <summary>REQ-030 (E5-S5): self-scoped repository for user channel preferences.</summary>
public sealed class UserChannelPreferenceRepository : IUserChannelPreferenceRepository
{
    private readonly ApplicationDbContext _context;

    public UserChannelPreferenceRepository(ApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<UserChannelPreference?> GetByUserIdAsync(Guid userId, CancellationToken cancellationToken = default)
        => await _context.UserChannelPreferences.FirstOrDefaultAsync(p => p.UserId == userId, cancellationToken);

    public async Task UpsertAsync(UserChannelPreference preference, CancellationToken cancellationToken = default)
    {
        var existing = await _context.UserChannelPreferences
            .FirstOrDefaultAsync(p => p.UserId == preference.UserId, cancellationToken);

        if (existing is null)
            await _context.UserChannelPreferences.AddAsync(preference, cancellationToken);
        else
            existing.SetPreferredChannel(preference.PreferredChannel);

        await _context.SaveChangesAsync(cancellationToken);
    }
}
