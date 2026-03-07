using FluentAssertions;
using IabConnect.Domain.Communication;
using Xunit;

namespace IabConnect.Application.Tests.Communication;

/// <summary>
/// REQ-029: Unit Tests for NewsletterSubscriber entity
/// </summary>
public class NewsletterSubscriberTests
{
    [Fact]
    public void Create_WithValidEmail_ShouldCreateActiveSubscriber()
    {
        var subscriber = NewsletterSubscriber.Create("test@example.com");

        subscriber.Email.Should().Be("test@example.com");
        subscriber.IsActive.Should().BeTrue();
        subscriber.SubscribedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        subscriber.ConfirmedAt.Should().NotBeNull();
        subscriber.UnsubscribedAt.Should().BeNull();
        subscriber.Id.Should().NotBeEmpty();
    }

    [Fact]
    public void Create_WithAllFields_ShouldSetAllProperties()
    {
        var subscriber = NewsletterSubscriber.Create(
            "User@Example.COM",
            firstName: " Max ",
            lastName: " Muster ",
            ipAddress: "192.168.1.1");

        subscriber.Email.Should().Be("user@example.com");
        subscriber.FirstName.Should().Be("Max");
        subscriber.LastName.Should().Be("Muster");
        subscriber.IpAddress.Should().Be("192.168.1.1");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_WithInvalidEmail_ShouldThrow(string? invalidEmail)
    {
        var act = () => NewsletterSubscriber.Create(invalidEmail!);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("email");
    }

    [Fact]
    public void Unsubscribe_ShouldDeactivateAndSetTimestamp()
    {
        var subscriber = NewsletterSubscriber.Create("test@example.com");

        subscriber.Unsubscribe();

        subscriber.IsActive.Should().BeFalse();
        subscriber.UnsubscribedAt.Should().NotBeNull();
        subscriber.UnsubscribedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Resubscribe_AfterUnsubscribe_ShouldReactivate()
    {
        var subscriber = NewsletterSubscriber.Create("test@example.com");
        subscriber.Unsubscribe();

        subscriber.Resubscribe("10.0.0.1");

        subscriber.IsActive.Should().BeTrue();
        subscriber.UnsubscribedAt.Should().BeNull();
        subscriber.SubscribedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        subscriber.IpAddress.Should().Be("10.0.0.1");
    }

    [Fact]
    public void Create_ShouldNormalizeEmailToLowerCase()
    {
        var subscriber = NewsletterSubscriber.Create("Test.User@EXAMPLE.COM");

        subscriber.Email.Should().Be("test.user@example.com");
    }

    [Fact]
    public void Create_WithNullOptionalFields_ShouldSetNulls()
    {
        var subscriber = NewsletterSubscriber.Create("test@example.com");

        subscriber.FirstName.Should().BeNull();
        subscriber.LastName.Should().BeNull();
        subscriber.IpAddress.Should().BeNull();
    }
}
