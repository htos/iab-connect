using FluentAssertions;
using IabConnect.Application.Communication.Messaging;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Messaging;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Messaging;

/// <summary>
/// REQ-030 (E5-S4) AC-7: channel selection, email delegation, disabled-stub behaviour, and
/// config-secret binding.
/// </summary>
public sealed class MessagingTests
{
    private static MessageRequest Request(MessageChannel channel = MessageChannel.Email) =>
        new(channel, "a@example.com", null, Guid.NewGuid(),
            new MessageContent("Subject", "<p>Body</p>", "Body"), "Verein", "noreply@example.org");

    private static MessageDispatcher Dispatcher(params IMessageChannelSender[] senders) =>
        new(senders, NullLogger<MessageDispatcher>.Instance);

    [Fact]
    public async Task EmailChannelSender_DelegatesToEmailSender()
    {
        var email = new Mock<IEmailSender>();
        var sut = new EmailChannelSender(email.Object);

        sut.Channel.Should().Be(MessageChannel.Email);
        sut.IsEnabled.Should().BeTrue();

        var result = await sut.SendAsync(Request(), CancellationToken.None);

        result.IsSent.Should().BeTrue();
        email.Verify(e => e.SendAsync(
            "a@example.com", "Subject", "<p>Body</p>", "Body", "Verein", "noreply@example.org",
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Dispatcher_RoutesToEmailSender_ForEmailChannel()
    {
        var email = new Mock<IEmailSender>();
        var result = await Dispatcher(new EmailChannelSender(email.Object))
            .DispatchAsync(Request(MessageChannel.Email), CancellationToken.None);

        result.IsSent.Should().BeTrue();
        result.Channel.Should().Be(MessageChannel.Email);
    }

    [Fact]
    public async Task Dispatcher_FallsBackToEmail_WhenSmsDisabled()
    {
        var email = new Mock<IEmailSender>();
        var sms = new SmsChannelSender(Options.Create(new SmsSettings { Enabled = false }));

        var result = await Dispatcher(new EmailChannelSender(email.Object), sms)
            .DispatchAsync(Request(MessageChannel.Sms), CancellationToken.None);

        result.IsSent.Should().BeTrue();
        result.Channel.Should().Be(MessageChannel.Email, "a disabled SMS channel falls back to email");
        email.Verify(e => e.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Dispatcher_SkipsCleanly_WhenChannelDisabledAndNoEmailFallback()
    {
        // Only an SMS sender, disabled, no email channel registered.
        var sms = new SmsChannelSender(Options.Create(new SmsSettings { Enabled = false }));
        var result = await Dispatcher(sms).DispatchAsync(Request(MessageChannel.Sms), CancellationToken.None);

        result.Status.Should().Be(MessageDeliveryStatus.Skipped);
        result.Reason.Should().Contain("disabled");
    }

    [Fact]
    public void SmsChannelSender_IsDisabledByDefault()
    {
        var sut = new SmsChannelSender(Options.Create(new SmsSettings()));
        sut.IsEnabled.Should().BeFalse();
        sut.Channel.Should().Be(MessageChannel.Sms);
    }

    [Fact]
    public async Task DisabledStub_Throws_WhenInvokedDirectly()
    {
        var sut = new WhatsAppChannelSender(Options.Create(new WhatsAppSettings { Enabled = false }));
        var act = async () => await sut.SendAsync(Request(MessageChannel.WhatsApp), CancellationToken.None);
        await act.Should().ThrowAsync<ChannelDisabledException>();
    }

    [Fact]
    public void SmsSettings_BindFromConfiguration_WithEnvVarSourceEngaged()
    {
        // A36/A53: exercise the env-var source AND override it with explicit values so the test is
        // deterministic regardless of the host shell.
        var config = new ConfigurationBuilder()
            .AddEnvironmentVariables()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["Sms:Enabled"] = "true",
                ["Sms:Provider"] = "twilio",
                ["Sms:FromNumber"] = "+41000000000",
            })
            .Build();

        var settings = config.GetSection(SmsSettings.SectionName).Get<SmsSettings>()!;

        settings.Enabled.Should().BeTrue();
        settings.Provider.Should().Be("twilio");
        settings.FromNumber.Should().Be("+41000000000");
    }

    [Fact]
    public async Task DefaultChannelPreferenceService_AlwaysResolvesEmail()
    {
        var sut = new DefaultChannelPreferenceService();
        var resolved = await sut.ResolveChannelAsync(Guid.NewGuid(), MessageChannel.Sms, null, CancellationToken.None);
        resolved.Should().Be(MessageChannel.Email);
    }
}
