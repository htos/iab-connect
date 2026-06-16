using FluentAssertions;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Persistence;
using IabConnect.Infrastructure.Persistence.Repositories;
using Microsoft.EntityFrameworkCore;
using Testcontainers.PostgreSql;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Repositories;

/// <summary>
/// REQ-028 (E5-S2) AC-7: Testcontainers persistence for automation executions — round-trip an
/// execution + its recipients, and prove the idempotency unique index actually rejects a duplicate
/// (the load-bearing structural guard, AC-3).
/// </summary>
public sealed class AutomationExecutionRepositoryTests : IAsyncLifetime
{
    private PostgreSqlContainer _postgres = null!;
    private ApplicationDbContext _context = null!;
    private AutomationExecutionRepository _repository = null!;

    public async ValueTask InitializeAsync()
    {
        _postgres = new PostgreSqlBuilder("postgres:18").Build();
        await _postgres.StartAsync(TestContext.Current.CancellationToken);

        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseNpgsql(_postgres.GetConnectionString())
            .Options;

        _context = new ApplicationDbContext(options);
        await _context.Database.EnsureCreatedAsync(TestContext.Current.CancellationToken);
        _repository = new AutomationExecutionRepository(_context);
    }

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _postgres.DisposeAsync();
    }

    private static AutomationExecution ExecutionWith(string key, AutomationRecipientStatus status = AutomationRecipientStatus.Sent)
    {
        var execution = AutomationExecution.Start(Guid.NewGuid());
        var recipient = status == AutomationRecipientStatus.Sent
            ? AutomationRecipient.Sent(execution.Id, key, Guid.NewGuid(), Guid.NewGuid(), "a@example.com", "A", "B", DateTime.UtcNow)
            : AutomationRecipient.Failed(execution.Id, key, Guid.NewGuid(), Guid.NewGuid(), "a@example.com", "A", "B", "err");
        execution.AddRecipient(recipient);
        execution.Complete();
        return execution;
    }

    [Fact]
    public async Task RoundTrip_PersistsExecutionAndRecipients()
    {
        var ct = TestContext.Current.CancellationToken;
        var key = $"def|MemberJoined|{Guid.NewGuid()}";
        var execution = ExecutionWith(key);

        await _repository.AddAsync(execution, ct);
        _context.ChangeTracker.Clear();

        var recent = await _repository.GetRecentForDefinitionAsync(execution.DefinitionId, 10, ct);
        recent.Should().ContainSingle();
        recent[0].SentCount.Should().Be(1);
        recent[0].Status.Should().Be(AutomationExecutionStatus.Completed);

        (await _repository.RecipientKeyExistsAsync(key, ct)).Should().BeTrue();
        (await _repository.RecipientKeyExistsAsync("nope", ct)).Should().BeFalse();
    }

    [Fact]
    public async Task UniqueIndex_RejectsDuplicateIdempotencyKey()
    {
        var ct = TestContext.Current.CancellationToken;
        var key = $"def|MemberJoined|{Guid.NewGuid()}";

        await _repository.AddAsync(ExecutionWith(key), ct);
        _context.ChangeTracker.Clear();

        // A second recipient row with the SAME idempotency key must be rejected by the unique index.
        var act = async () => await _repository.AddAsync(ExecutionWith(key), ct);
        await act.Should().ThrowAsync<DbUpdateException>();
    }

    [Fact]
    public async Task ExistingRecipientKeys_ReturnsOnlyMatches()
    {
        var ct = TestContext.Current.CancellationToken;
        var existing = $"def|MemberJoined|{Guid.NewGuid()}";
        await _repository.AddAsync(ExecutionWith(existing), ct);
        _context.ChangeTracker.Clear();

        var probe = new[] { existing, "absent-1", "absent-2" };
        var result = await _repository.ExistingRecipientKeysAsync(probe, ct);

        result.Should().BeEquivalentTo([existing]);
    }
}
