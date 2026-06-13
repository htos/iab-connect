using Microsoft.EntityFrameworkCore;

namespace IabConnect.Infrastructure.Persistence;

/// <summary>
/// Runs a multi-statement unit of work inside an explicit database transaction that is
/// compatible with a retrying execution strategy (<c>EnableRetryOnFailure</c>).
///
/// EF Core forbids a raw <c>BeginTransactionAsync</c> when a retrying strategy is configured
/// ("The configured execution strategy 'NpgsqlRetryingExecutionStrategy' does not support
/// user-initiated transactions"). The correct pattern is to drive the whole transaction
/// through <see cref="Microsoft.EntityFrameworkCore.Storage.IExecutionStrategy.ExecuteAsync"/>
/// so the strategy can retry the entire block as one retriable unit. This helper centralises
/// that pattern so call sites read like a plain transaction.
///
/// NOTE: because the strategy may re-run <paramref name="work"/> after a transient failure, the
/// delegate must be idempotent — build new entities inside it rather than reusing instances
/// mutated by a prior attempt.
/// </summary>
public static class DbExecutionStrategyExtensions
{
    public static async Task<T> ExecuteTransactionalAsync<T>(
        this ApplicationDbContext context,
        Func<Task<T>> work,
        CancellationToken cancellationToken = default)
    {
        var strategy = context.Database.CreateExecutionStrategy();
        return await strategy.ExecuteAsync(async () =>
        {
            await using var transaction = await context.Database.BeginTransactionAsync(cancellationToken);
            var result = await work();
            await transaction.CommitAsync(cancellationToken);
            return result;
        });
    }

    public static Task ExecuteTransactionalAsync(
        this ApplicationDbContext context,
        Func<Task> work,
        CancellationToken cancellationToken = default)
        => context.ExecuteTransactionalAsync(async () =>
        {
            await work();
            return true;
        }, cancellationToken);
}
