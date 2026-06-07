using FluentAssertions;
using IabConnect.Domain.Integration;
using Xunit;

namespace IabConnect.Application.Tests.Integration;

/// <summary>REQ-058 (E8-S3): domain tests for <see cref="WebhookSubscription"/> + the event whitelist.</summary>
public sealed class WebhookSubscriptionTests
{
    private static WebhookSubscription New(string url = "https://hooks.example.com/in", params string[] types)
        => WebhookSubscription.Create("My Hook", url,
            types.Length > 0 ? types : [WebhookEventTypes.EventCreated], "cipher-value");

    [Fact]
    public void Create_Valid_Succeeds()
    {
        var sub = New(types: WebhookEventTypes.EventCreated);
        sub.Name.Should().Be("My Hook");
        sub.Status.Should().Be(WebhookSubscriptionStatus.Active);
        sub.EventTypes.Should().Contain(WebhookEventTypes.EventCreated);
        sub.SecretCipher.Should().Be("cipher-value");
    }

    [Fact]
    public void Create_UnknownEventType_Throws()
    {
        var act = () => WebhookSubscription.Create("x", "https://h.example.com", ["member.deleted"], "c");
        act.Should().Throw<ArgumentException>().WithMessage("*Unknown webhook event type*");
    }

    [Theory]
    [InlineData("http://insecure.example.com")] // not https
    [InlineData("not-a-url")]
    [InlineData("ftp://example.com")]
    public void Create_NonHttpsUrl_Throws(string url)
    {
        var act = () => WebhookSubscription.Create("x", url, [WebhookEventTypes.EventCreated], "c");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Create_EmptyEventTypes_Throws()
    {
        var act = () => WebhookSubscription.Create("x", "https://h.example.com", [], "c");
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void Disable_Then_Enable_TogglesStatus()
    {
        var sub = New(types: WebhookEventTypes.EventCreated);
        sub.Disable();
        sub.Status.Should().Be(WebhookSubscriptionStatus.Disabled);
        sub.Enable();
        sub.Status.Should().Be(WebhookSubscriptionStatus.Active);
    }

    [Fact]
    public void UpdateConfiguration_ChangesUrlAndTypes()
    {
        var sub = New(types: WebhookEventTypes.EventCreated);
        sub.UpdateConfiguration("Renamed", "https://new.example.com/hook",
            [WebhookEventTypes.EventCreated, WebhookEventTypes.PaymentReceived]);
        sub.Name.Should().Be("Renamed");
        sub.TargetUrl.Should().Be("https://new.example.com/hook");
        sub.EventTypes.Should().BeEquivalentTo([WebhookEventTypes.EventCreated, WebhookEventTypes.PaymentReceived]);
    }

    [Fact]
    public void WebhookEventTypes_AreAllKnown()
    {
        WebhookEventTypes.AreAllKnown([WebhookEventTypes.EventCreated, WebhookEventTypes.PaymentReceived]).Should().BeTrue();
        WebhookEventTypes.AreAllKnown(["nope"]).Should().BeFalse();
    }
}
