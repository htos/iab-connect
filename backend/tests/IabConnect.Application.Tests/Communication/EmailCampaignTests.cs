using FluentAssertions;
using IabConnect.Domain.Communication;
using Xunit;

namespace IabConnect.Application.Tests.Communication;

/// <summary>
/// REQ-026: Unit Tests für EmailCampaign Domain Entity
/// </summary>
public class EmailCampaignTests
{
    [Fact]
    public void Create_WithValidData_ShouldCreateCampaign()
    {
        // Arrange
        var name = "Test Newsletter";
        var subject = "Willkommen!";
        var htmlContent = "<h1>Hallo</h1>";
        var fromName = "IAB Connect";
        var fromEmail = "noreply@iabconnect.ch";
        var createdById = Guid.NewGuid();
        var createdByName = "Admin User";

        // Act
        var campaign = EmailCampaign.Create(
            name, subject, htmlContent,
            fromName, fromEmail,
            createdById, createdByName,
            RecipientSegmentType.AllActiveMembers);

        // Assert
        campaign.Should().NotBeNull();
        campaign.Id.Should().NotBeEmpty();
        campaign.Name.Should().Be(name);
        campaign.Subject.Should().Be(subject);
        campaign.HtmlContent.Should().Be(htmlContent);
        campaign.FromName.Should().Be(fromName);
        campaign.FromEmail.Should().Be(fromEmail);
        campaign.Status.Should().Be(EmailCampaignStatus.Draft);
        campaign.SegmentType.Should().Be(RecipientSegmentType.AllActiveMembers);
        campaign.CreatedById.Should().Be(createdById);
        campaign.CreatedByName.Should().Be(createdByName);
        campaign.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Update_WhenDraft_ShouldUpdateFields()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        var newName = "Updated Newsletter";
        var newSubject = "Neuer Betreff";

        // Act
        campaign.Update(newName, newSubject, "<p>Neu</p>", null,
            "Neuer Absender", "neu@example.com", null);

        // Assert
        campaign.Name.Should().Be(newName);
        campaign.Subject.Should().Be(newSubject);
        campaign.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Update_WhenNotDraft_ShouldThrowException()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        campaign.StartSending(); // Status = Sending

        // Act & Assert
        var act = () => campaign.Update("Name", "Subject", "<p>Content</p>", null,
            "From", "from@example.com", null);

        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Schedule_WhenDraft_ShouldSetScheduledStatus()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        var scheduledAt = DateTime.UtcNow.AddDays(1);

        // Act
        campaign.Schedule(scheduledAt);

        // Assert
        campaign.Status.Should().Be(EmailCampaignStatus.Scheduled);
        campaign.ScheduledAt.Should().Be(scheduledAt);
    }

    [Fact]
    public void Schedule_WithPastDate_ShouldThrowException()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        var pastDate = DateTime.UtcNow.AddDays(-1);

        // Act & Assert
        var act = () => campaign.Schedule(pastDate);
        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void StartSending_WhenDraft_ShouldSetSendingStatus()
    {
        // Arrange
        var campaign = CreateDraftCampaign();

        // Act
        campaign.StartSending();

        // Assert
        campaign.Status.Should().Be(EmailCampaignStatus.Sending);
        campaign.SentAt.Should().NotBeNull();
    }

    [Fact]
    public void StartSending_WhenScheduled_ShouldSetSendingStatus()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        campaign.Schedule(DateTime.UtcNow.AddDays(1));

        // Act
        campaign.StartSending();

        // Assert
        campaign.Status.Should().Be(EmailCampaignStatus.Sending);
    }

    [Fact]
    public void CompleteSending_WhenSending_ShouldSetSentStatus()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        campaign.StartSending();

        // Act
        campaign.CompleteSending();

        // Assert
        campaign.Status.Should().Be(EmailCampaignStatus.Sent);
        campaign.CompletedAt.Should().NotBeNull();
    }

    [Fact]
    public void Cancel_WhenScheduled_ShouldSetCancelledStatus()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        campaign.Schedule(DateTime.UtcNow.AddDays(1));

        // Act
        campaign.Cancel();

        // Assert
        campaign.Status.Should().Be(EmailCampaignStatus.Cancelled);
    }

    [Fact]
    public void Cancel_WhenSent_ShouldThrowException()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        campaign.StartSending();
        campaign.CompleteSending();

        // Act & Assert
        var act = () => campaign.Cancel();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void AddRecipient_ShouldAddRecipientToCampaign()
    {
        // Arrange
        var campaign = CreateDraftCampaign();
        var memberId = Guid.NewGuid();
        var email = "test@example.com";
        var recipient = EmailRecipient.CreateForMember(campaign.Id, memberId, email, "Max", "Mustermann");

        // Act
        campaign.AddRecipient(recipient);

        // Assert
        campaign.Recipients.Should().Contain(recipient);
        campaign.TotalRecipients.Should().Be(1);
    }

    [Fact]
    public void UpdateStatistics_ShouldUpdateCounters()
    {
        // Arrange
        var campaign = CreateDraftCampaign();

        // Act
        campaign.UpdateStatistics(95, 80, 50, 20, 3, 2);

        // Assert
        campaign.SentCount.Should().Be(95);
        campaign.DeliveredCount.Should().Be(80);
        campaign.OpenedCount.Should().Be(50);
        campaign.ClickedCount.Should().Be(20);
        campaign.BouncedCount.Should().Be(3);
        campaign.FailedCount.Should().Be(2);
    }

    private static EmailCampaign CreateDraftCampaign()
    {
        return EmailCampaign.Create(
            "Test Campaign",
            "Test Subject",
            "<h1>Test</h1>",
            "IAB Connect",
            "noreply@iabconnect.ch",
            Guid.NewGuid(),
            "Test Admin",
            RecipientSegmentType.AllActiveMembers
        );
    }
}
