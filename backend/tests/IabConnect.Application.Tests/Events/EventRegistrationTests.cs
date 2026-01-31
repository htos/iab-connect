using FluentAssertions;
using IabConnect.Domain.Events;
using Xunit;

namespace IabConnect.Application.Tests.Events;

/// <summary>
/// REQ-020: Unit Tests for EventRegistration entity
/// </summary>
public class EventRegistrationTests
{
    private readonly Guid _testEventId = Guid.NewGuid();
    private readonly Guid _testUserId = Guid.NewGuid();
    private readonly Guid _testMemberId = Guid.NewGuid();

    #region Factory Method Tests

    [Fact]
    public void CreateForMember_WithValidData_ShouldCreateConfirmedRegistration()
    {
        // Act
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Max Mustermann",
            "max@example.com",
            numberOfGuests: 2,
            participantPhone: "+41 79 123 45 67",
            specialRequirements: "Vegetarian meal");

        // Assert
        registration.Should().NotBeNull();
        registration.Id.Should().NotBeEmpty();
        registration.EventId.Should().Be(_testEventId);
        registration.UserId.Should().Be(_testUserId);
        registration.MemberId.Should().Be(_testMemberId);
        registration.ParticipantName.Should().Be("Max Mustermann");
        registration.ParticipantEmail.Should().Be("max@example.com");
        registration.ParticipantPhone.Should().Be("+41 79 123 45 67");
        registration.NumberOfGuests.Should().Be(2);
        registration.SpecialRequirements.Should().Be("Vegetarian meal");
        registration.Status.Should().Be(RegistrationStatus.Confirmed);
        registration.IsWaitlisted.Should().BeFalse();
        registration.WaitlistPosition.Should().BeNull();
        registration.RegisteredAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        registration.ConfirmedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        registration.QrCodeToken.Should().NotBeNullOrEmpty();
        registration.IsActive.Should().BeTrue();
    }

    [Fact]
    public void CreateForGuest_WithValidData_ShouldCreatePendingRegistration()
    {
        // Act
        var registration = EventRegistration.CreateForGuest(
            _testEventId,
            "Anna Gast",
            "anna@example.com",
            numberOfGuests: 1);

        // Assert
        registration.Should().NotBeNull();
        registration.UserId.Should().BeNull();
        registration.MemberId.Should().BeNull();
        registration.ParticipantName.Should().Be("Anna Gast");
        registration.ParticipantEmail.Should().Be("anna@example.com");
        registration.Status.Should().Be(RegistrationStatus.Pending);
        registration.ConfirmedAt.Should().BeNull();
    }

    [Fact]
    public void CreateWaitlisted_WithValidData_ShouldCreateWaitlistedRegistration()
    {
        // Act
        var registration = EventRegistration.CreateWaitlisted(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Lisa Warteliste",
            "lisa@example.com",
            waitlistPosition: 3,
            numberOfGuests: 2);

        // Assert
        registration.Should().NotBeNull();
        registration.Status.Should().Be(RegistrationStatus.Waitlisted);
        registration.IsWaitlisted.Should().BeTrue();
        registration.WaitlistPosition.Should().Be(3);
        registration.ConfirmedAt.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    [InlineData(null)]
    public void CreateForMember_WithInvalidName_ShouldThrowException(string? invalidName)
    {
        // Act
        var act = () => EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            invalidName!,
            "test@example.com");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*name*");
    }

    [Theory]
    [InlineData("")]
    [InlineData("invalid-email")]
    [InlineData("@missing-local")]
    public void CreateForMember_WithInvalidEmail_ShouldThrowException(string invalidEmail)
    {
        // Act
        var act = () => EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            invalidEmail);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*email*");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    [InlineData(21)]
    public void CreateForMember_WithInvalidGuestCount_ShouldThrowException(int invalidCount)
    {
        // Act
        var act = () => EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com",
            numberOfGuests: invalidCount);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*guests*");
    }

    [Fact]
    public void CreateForMember_WithEmptyEventId_ShouldThrowException()
    {
        // Act
        var act = () => EventRegistration.CreateForMember(
            Guid.Empty,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*Event ID*");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void CreateWaitlisted_WithInvalidPosition_ShouldThrowException(int invalidPosition)
    {
        // Act
        var act = () => EventRegistration.CreateWaitlisted(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com",
            waitlistPosition: invalidPosition);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*position*");
    }

    #endregion

    #region State Transition Tests

    [Fact]
    public void Confirm_WhenPending_ShouldConfirmRegistration()
    {
        // Arrange
        var registration = EventRegistration.CreateForGuest(
            _testEventId,
            "Test User",
            "test@example.com");

        // Act
        registration.Confirm();

        // Assert
        registration.Status.Should().Be(RegistrationStatus.Confirmed);
        registration.ConfirmedAt.Should().NotBeNull();
        registration.IsWaitlisted.Should().BeFalse();
        registration.WaitlistPosition.Should().BeNull();
    }

    [Fact]
    public void Confirm_WhenAlreadyConfirmed_ShouldNotThrow()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act - should not throw
        var act = () => registration.Confirm();

        // Assert
        act.Should().NotThrow();
        registration.Status.Should().Be(RegistrationStatus.Confirmed);
    }

    [Fact]
    public void Confirm_WhenCancelled_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.Cancel();

        // Act
        var act = () => registration.Confirm();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*cancelled*");
    }

    [Fact]
    public void Cancel_WithReason_ShouldSetCancellationDetails()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act
        registration.Cancel("Unable to attend", cancelledByParticipant: true);

        // Assert
        registration.Status.Should().Be(RegistrationStatus.Cancelled);
        registration.CancelledAt.Should().NotBeNull();
        registration.CancellationReason.Should().Be("Unable to attend");
        registration.CancelledByParticipant.Should().BeTrue();
        registration.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Cancel_WhenAlreadyCancelled_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.Cancel();

        // Act
        var act = () => registration.Cancel();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already cancelled*");
    }

    [Fact]
    public void CheckIn_WhenConfirmed_ShouldSetCheckedInDetails()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        var staffMemberId = Guid.NewGuid();

        // Act
        registration.CheckIn(staffMemberId);

        // Assert
        registration.Status.Should().Be(RegistrationStatus.CheckedIn);
        registration.CheckedInAt.Should().NotBeNull();
        registration.CheckedInBy.Should().Be(staffMemberId);
        registration.IsCheckedIn.Should().BeTrue();
    }

    [Fact]
    public void CheckIn_WhenCancelled_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.Cancel();

        // Act
        var act = () => registration.CheckIn(Guid.NewGuid());

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*cancelled*");
    }

    [Fact]
    public void CheckIn_WhenAlreadyCheckedIn_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.CheckIn(Guid.NewGuid());

        // Act
        var act = () => registration.CheckIn(Guid.NewGuid());

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*already checked in*");
    }

    [Fact]
    public void CheckIn_WhenWaitlisted_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateWaitlisted(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com",
            waitlistPosition: 1);

        // Act
        var act = () => registration.CheckIn(Guid.NewGuid());

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*waitlisted*");
    }

    [Fact]
    public void MarkAsNoShow_WhenConfirmed_ShouldSetNoShowStatus()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act
        registration.MarkAsNoShow();

        // Assert
        registration.Status.Should().Be(RegistrationStatus.NoShow);
        registration.IsNoShow.Should().BeTrue();
        registration.IsActive.Should().BeFalse();
    }

    [Fact]
    public void MarkAsNoShow_WhenCheckedIn_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.CheckIn(Guid.NewGuid());

        // Act
        var act = () => registration.MarkAsNoShow();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*checked-in*");
    }

    #endregion

    #region Waitlist Tests

    [Fact]
    public void MoveToWaitlist_ShouldUpdateStatusAndPosition()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act
        registration.MoveToWaitlist(5);

        // Assert
        registration.Status.Should().Be(RegistrationStatus.Waitlisted);
        registration.IsWaitlisted.Should().BeTrue();
        registration.WaitlistPosition.Should().Be(5);
    }

    [Fact]
    public void MoveToWaitlist_WithInvalidPosition_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act
        var act = () => registration.MoveToWaitlist(0);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithMessage("*position*");
    }

    [Fact]
    public void PromoteFromWaitlist_ShouldConfirmRegistration()
    {
        // Arrange
        var registration = EventRegistration.CreateWaitlisted(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com",
            waitlistPosition: 1);

        // Act
        registration.PromoteFromWaitlist();

        // Assert
        registration.Status.Should().Be(RegistrationStatus.Confirmed);
        registration.IsWaitlisted.Should().BeFalse();
        registration.WaitlistPosition.Should().BeNull();
        registration.ConfirmedAt.Should().NotBeNull();
    }

    [Fact]
    public void PromoteFromWaitlist_WhenNotWaitlisted_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act
        var act = () => registration.PromoteFromWaitlist();

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*not on waitlist*");
    }

    [Fact]
    public void UpdateWaitlistPosition_ShouldUpdatePosition()
    {
        // Arrange
        var registration = EventRegistration.CreateWaitlisted(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com",
            waitlistPosition: 5);

        // Act
        registration.UpdateWaitlistPosition(3);

        // Assert
        registration.WaitlistPosition.Should().Be(3);
    }

    [Fact]
    public void UpdateWaitlistPosition_WhenNotWaitlisted_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Act
        var act = () => registration.UpdateWaitlistPosition(1);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*not on waitlist*");
    }

    #endregion

    #region Update Tests

    [Fact]
    public void UpdateDetails_WithValidData_ShouldUpdateAllFields()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Original Name",
            "original@example.com");

        // Act
        registration.UpdateDetails(
            "New Name",
            "new@example.com",
            "+41 79 999 99 99",
            3,
            "Wheelchair access",
            "VIP guest");

        // Assert
        registration.ParticipantName.Should().Be("New Name");
        registration.ParticipantEmail.Should().Be("new@example.com");
        registration.ParticipantPhone.Should().Be("+41 79 999 99 99");
        registration.NumberOfGuests.Should().Be(3);
        registration.SpecialRequirements.Should().Be("Wheelchair access");
        registration.Notes.Should().Be("VIP guest");
        registration.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void UpdateDetails_WhenCancelled_ShouldThrowException()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.Cancel();

        // Act
        var act = () => registration.UpdateDetails(
            "New Name",
            "new@example.com",
            null,
            1,
            null,
            null);

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*cancelled*");
    }

    [Fact]
    public void RegenerateQrCodeToken_ShouldCreateNewToken()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        var originalToken = registration.QrCodeToken;

        // Act
        registration.RegenerateQrCodeToken();

        // Assert
        registration.QrCodeToken.Should().NotBe(originalToken);
        registration.QrCodeToken.Should().NotBeNullOrEmpty();
        registration.UpdatedAt.Should().NotBeNull();
    }

    #endregion

    #region Computed Property Tests

    [Fact]
    public void TotalParticipants_ShouldReturnNumberOfGuests()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com",
            numberOfGuests: 4);

        // Assert
        registration.TotalParticipants.Should().Be(4);
    }

    [Fact]
    public void IsActive_WhenConfirmed_ShouldBeTrue()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");

        // Assert
        registration.IsActive.Should().BeTrue();
    }

    [Fact]
    public void IsActive_WhenCancelled_ShouldBeFalse()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.Cancel();

        // Assert
        registration.IsActive.Should().BeFalse();
    }

    [Fact]
    public void IsActive_WhenNoShow_ShouldBeFalse()
    {
        // Arrange
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "test@example.com");
        registration.MarkAsNoShow();

        // Assert
        registration.IsActive.Should().BeFalse();
    }

    #endregion

    #region Email Normalization Tests

    [Fact]
    public void CreateForMember_ShouldNormalizeEmail()
    {
        // Act
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "Test User",
            "  Test@EXAMPLE.com  ");

        // Assert
        registration.ParticipantEmail.Should().Be("test@example.com");
    }

    [Fact]
    public void CreateForMember_ShouldTrimNameAndPhone()
    {
        // Act
        var registration = EventRegistration.CreateForMember(
            _testEventId,
            _testUserId,
            _testMemberId,
            "  Test User  ",
            "test@example.com",
            participantPhone: "  +41 79 123  ");

        // Assert
        registration.ParticipantName.Should().Be("Test User");
        registration.ParticipantPhone.Should().Be("+41 79 123");
    }

    #endregion
}
