using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Application.Events;
using IabConnect.Domain.Common;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Events;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;
using Xunit.v3;

namespace IabConnect.Application.Tests.Events;

/// <summary>
/// REQ-021: Unit tests for EventNotificationService – email notifications for waitlist/registration.
/// </summary>
public class EventNotificationServiceTests
{
    private readonly Mock<IEmailSender> _emailSender = new();
    private readonly Mock<ILogger<EventNotificationService>> _logger = new();
    private readonly Mock<ISystemSettingsRepository> _settingsRepository = new();
    private readonly EventNotificationService _service;

    private static readonly SmtpSettings TestSmtpSettings = new()
    {
        FromName = "IAB Connect Test",
        FromEmail = "test@iabconnect.local"
    };

    public EventNotificationServiceTests()
    {
        var options = Options.Create(TestSmtpSettings);
        // REQ-086 (E9-S3): the service now resolves the org name from SystemSettings.
        _settingsRepository
            .Setup(r => r.GetSettingsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(SystemSettings.CreateDefault());
        _service = new EventNotificationService(
            _emailSender.Object, options, _settingsRepository.Object, _logger.Object);
    }

    // --- SendWaitlistConfirmationAsync ---

    [Fact]
    public async Task SendWaitlistConfirmation_CallsEmailSender_WithCorrectRecipient()
    {
        var (registration, evt) = CreateTestData(waitlisted: true, position: 3);

        await _service.SendWaitlistConfirmationAsync(registration, evt, TestContext.Current.CancellationToken);

        _emailSender.Verify(s => s.SendAsync(
            "guest@example.com",
            It.Is<string>(sub => sub.Contains(evt.Title)),
            It.Is<string>(html => html.Contains("Waitlist") && html.Contains("#3")),
            It.IsAny<string?>(),
            TestSmtpSettings.FromName,
            TestSmtpSettings.FromEmail,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- SendWaitlistPromotionAsync ---

    [Fact]
    public async Task SendWaitlistPromotion_CallsEmailSender_WithPromotionContent()
    {
        var (registration, evt) = CreateTestData();

        await _service.SendWaitlistPromotionAsync(registration, evt, TestContext.Current.CancellationToken);

        _emailSender.Verify(s => s.SendAsync(
            "guest@example.com",
            It.Is<string>(sub => sub.Contains(evt.Title)),
            It.Is<string>(html => html.Contains("confirmed")),
            It.IsAny<string?>(),
            TestSmtpSettings.FromName,
            TestSmtpSettings.FromEmail,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- SendRegistrationConfirmationAsync ---

    [Fact]
    public async Task SendRegistrationConfirmation_CallsEmailSender()
    {
        var (registration, evt) = CreateTestData();

        await _service.SendRegistrationConfirmationAsync(registration, evt, TestContext.Current.CancellationToken);

        _emailSender.Verify(s => s.SendAsync(
            "guest@example.com",
            It.Is<string>(sub => sub.Contains("Confirmed") && sub.Contains(evt.Title)),
            It.IsAny<string>(),
            It.IsAny<string?>(),
            TestSmtpSettings.FromName,
            TestSmtpSettings.FromEmail,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- SendCancellationNotificationAsync ---

    [Fact]
    public async Task SendCancellationNotification_CallsEmailSender()
    {
        var (registration, evt) = CreateTestData();

        await _service.SendCancellationNotificationAsync(registration, evt, TestContext.Current.CancellationToken);

        _emailSender.Verify(s => s.SendAsync(
            "guest@example.com",
            It.Is<string>(sub => sub.Contains("Cancelled") && sub.Contains(evt.Title)),
            It.IsAny<string>(),
            It.IsAny<string?>(),
            TestSmtpSettings.FromName,
            TestSmtpSettings.FromEmail,
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- REQ-086 (E9-S3): configured organization name in email HTML ---

    [Fact]
    public async Task SendRegistrationConfirmation_RendersConfiguredOrganizationName()
    {
        // A deployment that has set a custom ApplicationName must see it in the email header,
        // not the hardcoded "IAB Connect".
        var configured = SystemSettings.CreateDefault();
        configured.UpdateBranding("Acme Verein", "AV", "#000000", "#FFFFFF");
        _settingsRepository
            .Setup(r => r.GetSettingsAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(configured);

        var (registration, evt) = CreateTestData();

        await _service.SendRegistrationConfirmationAsync(
            registration, evt, TestContext.Current.CancellationToken);

        _emailSender.Verify(s => s.SendAsync(
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.Is<string>(html => html.Contains("Acme Verein") && !html.Contains(">IAB Connect<")),
            It.IsAny<string?>(),
            It.IsAny<string>(),
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // --- Error resilience ---

    [Fact]
    public async Task SendEmail_WhenSenderThrows_DoesNotRethrow()
    {
        _emailSender.Setup(s => s.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("SMTP connection failed"));

        var (registration, evt) = CreateTestData();

        // Should NOT throw
        var act = () => _service.SendRegistrationConfirmationAsync(registration, evt, TestContext.Current.CancellationToken);
        await act.Should().NotThrowAsync();
    }

    [Fact]
    public async Task SendEmail_WhenSenderThrows_LogsError()
    {
        _emailSender.Setup(s => s.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<string?>(), It.IsAny<string>(), It.IsAny<string>(),
            It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("SMTP failure"));

        var (registration, evt) = CreateTestData();

        await _service.SendWaitlistConfirmationAsync(registration, evt, TestContext.Current.CancellationToken);

        _logger.Verify(
            x => x.Log(
                LogLevel.Error,
                It.IsAny<EventId>(),
                It.IsAny<It.IsAnyType>(),
                It.IsAny<Exception>(),
                It.IsAny<Func<It.IsAnyType, Exception?, string>>()),
            Times.Once);
    }

    // --- Helpers ---

    private static (EventRegistration registration, Event evt) CreateTestData(bool waitlisted = false, int? position = null)
    {
        var evt = Event.Create(
            "Summer Festival 2025",
            "A great cultural event",
            "IAB Community Hall, Zürich",
            DateTime.UtcNow.AddDays(30),
            DateTime.UtcNow.AddDays(30).AddHours(4));

        EventRegistration registration;
        if (waitlisted)
        {
            registration = EventRegistration.CreateWaitlisted(
                evt.Id,
                userId: null,
                memberId: null,
                "Test Guest",
                "guest@example.com",
                waitlistPosition: position ?? 1,
                numberOfGuests: 2,
                participantPhone: "+41 79 000 00 00");
        }
        else
        {
            registration = EventRegistration.CreateForGuest(
                evt.Id,
                "Test Guest",
                "guest@example.com",
                numberOfGuests: 2,
                participantPhone: "+41 79 000 00 00");
        }

        return (registration, evt);
    }
}
