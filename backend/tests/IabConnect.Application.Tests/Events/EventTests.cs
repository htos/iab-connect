using FluentAssertions;
using IabConnect.Domain.Events;
using Xunit;

namespace IabConnect.Application.Tests.Events;

/// <summary>
/// REQ-019: Unit tests for Event domain entity.
/// Tests event creation, state transitions, and business rules.
/// </summary>
public class EventTests
{
    private readonly Guid _organizerId = Guid.NewGuid();
    private readonly string _organizerName = "Test Organizer";
    private readonly DateTime _futureDate = DateTime.UtcNow.AddDays(30);
    private readonly DateTime _futureEndDate = DateTime.UtcNow.AddDays(30).AddHours(3);

    #region Event Creation Tests

    [Fact]
    public void Create_WithValidData_ReturnsEvent()
    {
        // Arrange
        const string title = "Diwali Celebration 2024";
        const string description = "Annual Diwali celebration event";
        const string location = "Community Center";

        // Act
        var evt = Event.Create(
            title,
            description,
            location,
            _futureDate,
            _futureEndDate,
            _organizerId,
            _organizerName);

        // Assert
        evt.Should().NotBeNull();
        evt.Id.Should().NotBeEmpty();
        evt.Title.Should().Be(title);
        evt.Description.Should().Be(description);
        evt.Location.Should().Be(location);
        evt.StartDate.Should().Be(_futureDate);
        evt.EndDate.Should().Be(_futureEndDate);
        evt.OrganizerId.Should().Be(_organizerId);
        evt.OrganizerName.Should().Be(_organizerName);
        evt.Status.Should().Be(EventStatus.Draft);
        evt.Visibility.Should().Be(EventVisibility.MembersOnly);
        evt.Category.Should().Be(EventCategory.General);
        evt.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Create_WithEmptyTitle_ThrowsArgumentException()
    {
        // Act
        var act = () => Event.Create(
            string.Empty,
            "Description",
            "Location",
            _futureDate,
            _futureEndDate,
            _organizerId,
            _organizerName);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("title");
    }

    [Fact]
    public void Create_WithEmptyDescription_ThrowsArgumentException()
    {
        // Act
        var act = () => Event.Create(
            "Title",
            string.Empty,
            "Location",
            _futureDate,
            _futureEndDate,
            _organizerId,
            _organizerName);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("description");
    }

    [Fact]
    public void Create_WithEmptyLocation_ThrowsArgumentException()
    {
        // Act
        var act = () => Event.Create(
            "Title",
            "Description",
            string.Empty,
            _futureDate,
            _futureEndDate,
            _organizerId,
            _organizerName);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("location");
    }

    [Fact]
    public void Create_WithEndDateBeforeStartDate_ThrowsArgumentException()
    {
        // Act
        var act = () => Event.Create(
            "Title",
            "Description",
            "Location",
            _futureEndDate,
            _futureDate, // End before start
            _organizerId,
            _organizerName);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*end date*start date*");
    }

    #endregion

    #region UpdateDetails Tests

    [Fact]
    public void UpdateDetails_WithValidData_UpdatesProperties()
    {
        // Arrange
        var evt = CreateTestEvent();
        const string newTitle = "Updated Title";
        const string newDescription = "Updated Description";
        const string shortDescription = "Short desc";
        const string newLocation = "New Location";
        const string locationAddress = "123 Main St";
        const string locationUrl = "https://maps.google.com/test";

        // Act
        evt.UpdateDetails(newTitle, newDescription, shortDescription, newLocation, locationAddress, locationUrl);

        // Assert
        evt.Title.Should().Be(newTitle);
        evt.Description.Should().Be(newDescription);
        evt.ShortDescription.Should().Be(shortDescription);
        evt.Location.Should().Be(newLocation);
        evt.LocationAddress.Should().Be(locationAddress);
        evt.LocationUrl.Should().Be(locationUrl);
        evt.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    #endregion

    #region UpdateSchedule Tests

    [Fact]
    public void UpdateSchedule_WithValidDates_UpdatesSchedule()
    {
        // Arrange
        var evt = CreateTestEvent();
        var newStart = DateTime.UtcNow.AddDays(60);
        var newEnd = DateTime.UtcNow.AddDays(60).AddHours(5);
        const string timeZone = "America/New_York";

        // Act
        evt.UpdateSchedule(newStart, newEnd, true, timeZone);

        // Assert
        evt.StartDate.Should().Be(newStart);
        evt.EndDate.Should().Be(newEnd);
        evt.IsAllDay.Should().BeTrue();
        evt.TimeZone.Should().Be(timeZone);
    }

    [Fact]
    public void UpdateSchedule_WithInvalidDateRange_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        var act = () => evt.UpdateSchedule(
            DateTime.UtcNow.AddDays(60),
            DateTime.UtcNow.AddDays(59), // End before start
            false,
            "Europe/Zurich");

        // Assert
        act.Should().Throw<ArgumentException>();
    }

    #endregion

    #region UpdateRegistrationSettings Tests

    [Fact]
    public void UpdateRegistrationSettings_WithValidSettings_UpdatesRegistration()
    {
        // Arrange
        var evt = CreateTestEvent();
        var deadline = DateTime.UtcNow.AddDays(25);

        // Act
        evt.UpdateRegistrationSettings(true, 50, deadline, true);

        // Assert
        evt.RegistrationRequired.Should().BeTrue();
        evt.MaxParticipants.Should().Be(50);
        evt.RegistrationDeadline.Should().Be(deadline);
        evt.WaitlistEnabled.Should().BeTrue();
    }

    [Fact]
    public void UpdateRegistrationSettings_WithNullValues_ClearsSettings()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateRegistrationSettings(true, 50, DateTime.UtcNow.AddDays(25), true);

        // Act
        evt.UpdateRegistrationSettings(false, null, null, false);

        // Assert
        evt.RegistrationRequired.Should().BeFalse();
        evt.MaxParticipants.Should().BeNull();
        evt.RegistrationDeadline.Should().BeNull();
        evt.WaitlistEnabled.Should().BeFalse();
    }

    #endregion

    #region Status Transition Tests

    [Fact]
    public void Publish_FromDraft_PublishesEvent()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Status.Should().Be(EventStatus.Draft);

        // Act
        evt.Publish();

        // Assert
        evt.Status.Should().Be(EventStatus.Published);
        evt.PublishedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Publish_WhenAlreadyPublished_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Publish();

        // Act
        var act = () => evt.Publish();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already published*");
    }

    [Fact]
    public void Publish_WhenCancelled_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Cancel("Test cancellation");

        // Act
        var act = () => evt.Publish();

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Unpublish_WhenPublished_ReturnsToDraft()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Publish();

        // Act
        evt.Unpublish();

        // Assert
        evt.Status.Should().Be(EventStatus.Draft);
        evt.PublishedAt.Should().BeNull();
    }

    [Fact]
    public void Unpublish_WhenNotPublished_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        var act = () => evt.Unpublish();

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Cancel_WithReason_CancelsEvent()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Publish();
        const string reason = "Weather conditions";

        // Act
        evt.Cancel(reason);

        // Assert
        evt.Status.Should().Be(EventStatus.Cancelled);
        evt.CancellationReason.Should().Be(reason);
        evt.CancelledAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Cancel_WhenAlreadyCancelled_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Cancel("First cancellation");

        // Act
        var act = () => evt.Cancel("Second cancellation");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already cancelled*");
    }

    [Fact]
    public void Complete_WhenPublished_CompletesEvent()
    {
        // Arrange
        var evt = Event.Create(
            "Past Event",
            "Description",
            "Location",
            DateTime.UtcNow.AddDays(-2),
            DateTime.UtcNow.AddDays(-1),
            _organizerId,
            _organizerName);
        evt.Publish();

        // Act
        evt.Complete();

        // Assert
        evt.Status.Should().Be(EventStatus.Completed);
    }

    [Fact]
    public void Complete_WhenDraft_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        var act = () => evt.Complete();

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region Soft Delete Tests

    [Fact]
    public void Delete_SetsDeletedFlag()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        evt.Delete();

        // Assert
        evt.IsDeleted.Should().BeTrue();
        evt.DeletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Delete_WhenAlreadyDeleted_ThrowsException()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.Delete();

        // Act
        var act = () => evt.Delete();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already deleted*");
    }

    #endregion

    #region Visibility Tests

    [Fact]
    public void SetVisibility_UpdatesVisibility()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        evt.SetVisibility(EventVisibility.Public);

        // Assert
        evt.Visibility.Should().Be(EventVisibility.Public);
    }

    #endregion

    #region Categorization Tests

    [Fact]
    public void UpdateCategorization_UpdatesCategoryAndTags()
    {
        // Arrange
        var evt = CreateTestEvent();
        var tags = new List<string> { "festival", "family", "culture" };

        // Act
        evt.UpdateCategorization(EventCategory.Festival, tags);

        // Assert
        evt.Category.Should().Be(EventCategory.Festival);
        evt.Tags.Should().BeEquivalentTo(tags);
    }

    [Fact]
    public void UpdateCategorization_WithNullTags_ClearsTags()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateCategorization(EventCategory.Cultural, new List<string> { "tag1" });

        // Act
        evt.UpdateCategorization(EventCategory.Cultural, null);

        // Assert
        evt.Tags.Should().BeEmpty();
    }

    #endregion

    #region Cost Tests

    [Fact]
    public void UpdateCost_WithPrice_SetsNotFree()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        evt.UpdateCost(25.50m, "Includes dinner");

        // Assert
        evt.Cost.Should().Be(25.50m);
        evt.CostDescription.Should().Be("Includes dinner");
        evt.IsFree.Should().BeFalse();
    }

    [Fact]
    public void UpdateCost_WithZero_SetsFree()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateCost(25.50m, "Includes dinner");

        // Act
        evt.UpdateCost(0, null);

        // Assert
        evt.Cost.Should().Be(0);
        evt.IsFree.Should().BeTrue();
    }

    [Fact]
    public void UpdateCost_WithNull_SetsFree()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateCost(25.50m, "Includes dinner");

        // Act
        evt.UpdateCost(null, null);

        // Assert
        evt.Cost.Should().BeNull();
        evt.IsFree.Should().BeTrue();
    }

    #endregion

    #region Computed Properties Tests

    [Fact]
    public void HasStarted_WhenStartDateInPast_ReturnsTrue()
    {
        // Arrange
        var evt = Event.Create(
            "Past Event",
            "Description",
            "Location",
            DateTime.UtcNow.AddHours(-1),
            DateTime.UtcNow.AddHours(2),
            _organizerId,
            _organizerName);

        // Assert
        evt.HasStarted.Should().BeTrue();
    }

    [Fact]
    public void HasStarted_WhenStartDateInFuture_ReturnsFalse()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Assert
        evt.HasStarted.Should().BeFalse();
    }

    [Fact]
    public void HasEnded_WhenEndDateInPast_ReturnsTrue()
    {
        // Arrange
        var evt = Event.Create(
            "Ended Event",
            "Description",
            "Location",
            DateTime.UtcNow.AddHours(-3),
            DateTime.UtcNow.AddHours(-1),
            _organizerId,
            _organizerName);

        // Assert
        evt.HasEnded.Should().BeTrue();
    }

    [Fact]
    public void HasEnded_WhenEndDateInFuture_ReturnsFalse()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Assert
        evt.HasEnded.Should().BeFalse();
    }

    [Fact]
    public void IsRegistrationOpen_WhenPublishedWithNoDeadline_ReturnsTrue()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateRegistrationSettings(true, 50, null, false);
        evt.Publish();

        // Assert
        evt.IsRegistrationOpen.Should().BeTrue();
    }

    [Fact]
    public void IsRegistrationOpen_WhenDeadlinePassed_ReturnsFalse()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateRegistrationSettings(true, 50, DateTime.UtcNow.AddHours(-1), false);
        evt.Publish();

        // Assert
        evt.IsRegistrationOpen.Should().BeFalse();
    }

    [Fact]
    public void IsRegistrationOpen_WhenNotPublished_ReturnsFalse()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateRegistrationSettings(true, 50, null, false);

        // Assert
        evt.IsRegistrationOpen.Should().BeFalse();
    }

    [Fact]
    public void IsRegistrationOpen_WhenRegistrationNotRequired_ReturnsFalse()
    {
        // Arrange
        var evt = CreateTestEvent();
        evt.UpdateRegistrationSettings(false, null, null, false);
        evt.Publish();

        // Assert
        evt.IsRegistrationOpen.Should().BeFalse();
    }

    #endregion

    #region Contact Tests

    [Fact]
    public void UpdateContact_SetsContactInfo()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        evt.UpdateContact("test@example.com", "+41 31 123 45 67");

        // Assert
        evt.ContactEmail.Should().Be("test@example.com");
        evt.ContactPhone.Should().Be("+41 31 123 45 67");
    }

    #endregion

    #region Image Tests

    [Fact]
    public void UpdateImage_SetsImageInfo()
    {
        // Arrange
        var evt = CreateTestEvent();

        // Act
        evt.UpdateImage("https://example.com/image.jpg", "Event image");

        // Assert
        evt.ImageUrl.Should().Be("https://example.com/image.jpg");
        evt.ImageAltText.Should().Be("Event image");
    }

    #endregion

    #region Helper Methods

    private Event CreateTestEvent()
    {
        return Event.Create(
            "Test Event",
            "Test Description",
            "Test Location",
            _futureDate,
            _futureEndDate,
            _organizerId,
            _organizerName);
    }

    #endregion
}
