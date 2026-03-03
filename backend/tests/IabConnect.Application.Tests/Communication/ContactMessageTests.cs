using FluentAssertions;
using IabConnect.Domain.Communication;
using Xunit;

namespace IabConnect.Application.Tests.Communication;

/// <summary>
/// Unit tests for ContactMessage entity
/// REQ-049: Kontaktformular + Spam-Schutz
/// </summary>
public class ContactMessageTests
{
    #region Create Tests

    [Fact]
    public void Create_ValidInput_ShouldSetAllProperties()
    {
        var msg = ContactMessage.Create("John Doe", "john@example.com", "General Inquiry", "Hello, I have a question.");

        msg.Name.Should().Be("John Doe");
        msg.Email.Should().Be("john@example.com");
        msg.Subject.Should().Be("General Inquiry");
        msg.Message.Should().Be("Hello, I have a question.");
    }

    [Fact]
    public void Create_NewMessage_ShouldSetStatusToNew()
    {
        var msg = ContactMessage.Create("Test", "test@test.com", "Subject", "Body");
        msg.Status.Should().Be(ContactMessageStatus.New);
    }

    [Fact]
    public void Create_NewMessage_ShouldGenerateNewId()
    {
        var msg = ContactMessage.Create("Test", "test@test.com", "Subject", "Body");
        msg.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_WithWhitespace_ShouldTrimValues()
    {
        var msg = ContactMessage.Create("  John Doe  ", "  john@example.com  ", "  Subject  ", "  Message  ");
        msg.Name.Should().Be("John Doe");
        msg.Email.Should().Be("john@example.com");
        msg.Subject.Should().Be("Subject");
        msg.Message.Should().Be("Message");
    }

    [Theory]
    [InlineData("", "test@test.com", "Subject", "Body")]
    [InlineData("Name", "", "Subject", "Body")]
    [InlineData("Name", "test@test.com", "", "Body")]
    [InlineData("Name", "test@test.com", "Subject", "")]
    [InlineData(null, "test@test.com", "Subject", "Body")]
    public void Create_WithMissingRequiredFields_ShouldThrowArgumentException(string? name, string email, string subject, string message)
    {
        var act = () => ContactMessage.Create(name!, email, subject, message);
        act.Should().Throw<ArgumentException>();
    }

    #endregion

    #region Status Transition Tests

    [Fact]
    public void MarkAsRead_ShouldSetStatusToRead()
    {
        var msg = CreateTestMessage();
        msg.MarkAsRead(Guid.NewGuid());
        msg.Status.Should().Be(ContactMessageStatus.Read);
    }

    [Fact]
    public void MarkAsResponded_ShouldSetStatusAndNotes()
    {
        var msg = CreateTestMessage();
        var userId = Guid.NewGuid();
        msg.MarkAsResponded("Called back", userId);

        msg.Status.Should().Be(ContactMessageStatus.Responded);
        msg.ResponseNotes.Should().Be("Called back");
        msg.RespondedBy.Should().Be(userId);
        msg.RespondedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkAsResponded_WithNullNotes_ShouldStillSetStatus()
    {
        var msg = CreateTestMessage();
        msg.MarkAsResponded(null, Guid.NewGuid());
        msg.Status.Should().Be(ContactMessageStatus.Responded);
        msg.ResponseNotes.Should().BeNull();
    }

    [Fact]
    public void Archive_ShouldSetStatusToArchived()
    {
        var msg = CreateTestMessage();
        msg.Archive(Guid.NewGuid());
        msg.Status.Should().Be(ContactMessageStatus.Archived);
    }

    #endregion

    #region Helpers

    private static ContactMessage CreateTestMessage() =>
        ContactMessage.Create("Test User", "test@example.com", "General Inquiry", "This is a test message.");

    #endregion
}
