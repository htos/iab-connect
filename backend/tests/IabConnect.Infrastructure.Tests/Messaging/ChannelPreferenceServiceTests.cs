using FluentAssertions;
using IabConnect.Application.Communication.Messaging;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Messaging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Messaging;

/// <summary>
/// REQ-030 (E5-S5) AC-2/AC-3/AC-7: the three-way eligibility matrix — consent AND preference AND
/// availability before a channel is used; graceful degradation (skip / email-fallback / email-default).
/// </summary>
public sealed class ChannelPreferenceServiceTests
{
    private readonly Mock<IUserChannelPreferenceRepository> _prefs = new();
    private readonly Mock<IConsentRepository> _consents = new();

    private ChannelPreferenceService Build(bool smsEnabled = false, bool emailEnabled = true)
    {
        var senders = new List<IMessageChannelSender>();
        if (emailEnabled) senders.Add(new EmailChannelSender(Mock.Of<IabConnect.Infrastructure.Email.IEmailSender>()));
        senders.Add(new SmsChannelSender(Options.Create(new SmsSettings { Enabled = smsEnabled })));
        return new ChannelPreferenceService(_prefs.Object, _consents.Object, senders);
    }

    private void SetPreference(Guid userId, MessageChannel channel)
        => _prefs.Setup(p => p.GetByUserIdAsync(userId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(UserChannelPreference.Create(userId, channel.ToString()));

    [Fact]
    public async Task ConsentMissing_ReturnsNull_Skip()
    {
        var user = Guid.NewGuid();
        _consents.Setup(c => c.HasConsentAsync(user, ConsentType.Newsletter, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var result = await Build().ResolveChannelAsync(user, MessageChannel.Email, ConsentType.Newsletter, TestContext.Current.CancellationToken);
        result.Should().BeNull("no consent → skip");
    }

    [Fact]
    public async Task NoExplicitPreference_DefaultsToEmail()
    {
        var user = Guid.NewGuid();
        _prefs.Setup(p => p.GetByUserIdAsync(user, It.IsAny<CancellationToken>()))
            .ReturnsAsync((UserChannelPreference?)null);

        var result = await Build().ResolveChannelAsync(user, MessageChannel.Email, null, TestContext.Current.CancellationToken);
        result.Should().Be(MessageChannel.Email);
    }

    [Fact]
    public async Task ConsentAndPreferenceAndAvailable_UsesPreferred()
    {
        var user = Guid.NewGuid();
        _consents.Setup(c => c.HasConsentAsync(user, ConsentType.EventNotifications, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        SetPreference(user, MessageChannel.Sms);

        var result = await Build(smsEnabled: true)
            .ResolveChannelAsync(user, MessageChannel.Email, ConsentType.EventNotifications, TestContext.Current.CancellationToken);

        result.Should().Be(MessageChannel.Sms, "consent + preference + provider available → use preferred");
    }

    [Fact]
    public async Task PreferredChannelDisabled_FallsBackToEmail()
    {
        var user = Guid.NewGuid();
        SetPreference(user, MessageChannel.Sms);

        var result = await Build(smsEnabled: false) // SMS disabled, email enabled
            .ResolveChannelAsync(user, MessageChannel.Email, null, TestContext.Current.CancellationToken);

        result.Should().Be(MessageChannel.Email, "preferred unavailable → fall back to email");
    }

    [Fact]
    public async Task PreferredAndEmailBothUnavailable_ReturnsNull_Skip()
    {
        var user = Guid.NewGuid();
        SetPreference(user, MessageChannel.Sms);

        var result = await Build(smsEnabled: false, emailEnabled: false)
            .ResolveChannelAsync(user, MessageChannel.Email, null, TestContext.Current.CancellationToken);

        result.Should().BeNull("nothing available → skip, never wrong-channel");
    }

    [Fact]
    public async Task NoUserId_DefaultsToEmail_NoConsentCheck()
    {
        // A non-member recipient (no Keycloak user id) gets the email default; consent is only
        // checked when there is a user id to check it against.
        var result = await Build().ResolveChannelAsync(null, MessageChannel.Email, ConsentType.Newsletter, TestContext.Current.CancellationToken);
        result.Should().Be(MessageChannel.Email);
    }
}
