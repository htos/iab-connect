using System.Collections.Concurrent;
using IabConnect.Application.Integration;

namespace IabConnect.Api.Tests;

/// <summary>
/// REQ-058 (E8-S3): a recording <see cref="IWebhookDispatchService"/> double so trigger tests can
/// assert the write path emitted the expected event type + payload, without performing any delivery.
/// Registered as a singleton in <see cref="TestWebApplicationFactory"/>; call <see cref="Reset"/> per test.
/// </summary>
public sealed class TestWebhookDispatchService : IWebhookDispatchService
{
    public sealed record Emission(string EventType, object Payload);

    private readonly ConcurrentQueue<Emission> _emissions = new();

    public IReadOnlyList<Emission> Emissions => _emissions.ToList();

    public Task EmitAsync(string eventType, object payload, CancellationToken cancellationToken = default)
    {
        _emissions.Enqueue(new Emission(eventType, payload));
        return Task.CompletedTask;
    }

    public void Reset() => _emissions.Clear();
}
