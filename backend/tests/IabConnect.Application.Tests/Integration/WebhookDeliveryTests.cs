using FluentAssertions;
using IabConnect.Domain.Integration;
using Xunit;

namespace IabConnect.Application.Tests.Integration;

/// <summary>
/// REQ-058 (E8-S4): domain tests for <see cref="WebhookDelivery"/> transitions and the
/// <see cref="WebhookSubscription"/> auto-pause failure policy (AC-2/4).
/// </summary>
public sealed class WebhookDeliveryTests
{
    private static WebhookDelivery NewPending() =>
        WebhookDelivery.Pending(Guid.NewGuid(), WebhookEventTypes.EventCreated,
            "https://h.example.com", "sub|event.created|hash", "{\"a\":1}");

    [Fact]
    public void Pending_StartsWithNoAttempts()
    {
        var d = NewPending();
        d.Status.Should().Be(WebhookDeliveryStatus.Pending);
        d.AttemptCount.Should().Be(0);
    }

    [Fact]
    public void BeginAttempt_IncrementsAndStamps()
    {
        var d = NewPending();
        d.BeginAttempt();
        d.AttemptCount.Should().Be(1);
        d.LastAttemptAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkDelivered_SetsStatusAndCode()
    {
        var d = NewPending();
        d.BeginAttempt();
        d.MarkDelivered(200);
        d.Status.Should().Be(WebhookDeliveryStatus.Delivered);
        d.ResponseStatusCode.Should().Be(200);
        d.Error.Should().BeNull();
    }

    [Fact]
    public void MarkFailed_SetsStatusErrorAndTruncates()
    {
        var d = NewPending();
        d.MarkFailed(500, new string('x', 2000), DateTime.UtcNow);
        d.Status.Should().Be(WebhookDeliveryStatus.Failed);
        d.ResponseStatusCode.Should().Be(500);
        d.Error!.Length.Should().BeLessThanOrEqualTo(1000);
    }

    // --- Subscription auto-pause policy (AC-4) ---

    private static WebhookSubscription NewSub() =>
        WebhookSubscription.Create("Hook", "https://h.example.com", [WebhookEventTypes.EventCreated], "cipher");

    [Fact]
    public void RecordFailure_PausesAtThreshold()
    {
        var sub = NewSub();
        for (var i = 0; i < 2; i++) sub.RecordFailure(pauseThreshold: 3);
        sub.Status.Should().Be(WebhookSubscriptionStatus.Active);
        sub.ConsecutiveFailureCount.Should().Be(2);

        sub.RecordFailure(pauseThreshold: 3); // 3rd → pause
        sub.Status.Should().Be(WebhookSubscriptionStatus.Paused);
    }

    [Fact]
    public void RecordSuccess_ResetsFailureStreak()
    {
        var sub = NewSub();
        sub.RecordFailure(pauseThreshold: 5);
        sub.RecordFailure(pauseThreshold: 5);
        sub.ConsecutiveFailureCount.Should().Be(2);

        sub.RecordSuccess();
        sub.ConsecutiveFailureCount.Should().Be(0);
        sub.Status.Should().Be(WebhookSubscriptionStatus.Active);
    }

    [Fact]
    public void Enable_ClearsFailureStreak()
    {
        var sub = NewSub();
        for (var i = 0; i < 3; i++) sub.RecordFailure(pauseThreshold: 3);
        sub.Status.Should().Be(WebhookSubscriptionStatus.Paused);

        sub.Enable();
        sub.Status.Should().Be(WebhookSubscriptionStatus.Active);
        sub.ConsecutiveFailureCount.Should().Be(0);
    }

    [Fact]
    public void RecordFailure_NoOpWhenDisabled()
    {
        var sub = NewSub();
        sub.Disable();
        sub.RecordFailure(pauseThreshold: 1);
        sub.Status.Should().Be(WebhookSubscriptionStatus.Disabled);
        sub.ConsecutiveFailureCount.Should().Be(0);
    }
}
