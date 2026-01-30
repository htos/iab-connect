using FluentAssertions;
using IabConnect.Domain.Privacy;
using Xunit;

namespace IabConnect.Application.Tests.Privacy;

/// <summary>
/// Unit tests for DeletionRequest entity (REQ-012: DSGVO Art. 17 - Right to be forgotten)
/// </summary>
public class DeletionRequestTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private const string Email = "test@example.com";
    private const string Reason = "I want to delete my account";

    [Fact]
    public void Create_NewRequest_ShouldHavePendingStatus()
    {
        // Act
        var request = DeletionRequest.Create(_userId, Email, Reason);

        // Assert
        request.Status.Should().Be(DeletionRequestStatus.Pending);
        request.UserId.Should().Be(_userId);
        request.Email.Should().Be(Email);
        request.Reason.Should().Be(Reason);
        request.RequestedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        request.ConfirmationToken.Should().NotBeNullOrEmpty();
        request.TokenExpiresAt.Should().BeCloseTo(DateTime.UtcNow.AddDays(7), TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Confirm_WithValidToken_ShouldChangeStatusToConfirmed()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);
        var token = request.ConfirmationToken!;

        // Act
        var result = request.Confirm(token);

        // Assert
        result.Should().BeTrue();
        request.Status.Should().Be(DeletionRequestStatus.Confirmed);
        request.ConfirmedAt.Should().NotBeNull();
        request.ConfirmationToken.Should().BeNull(); // Token cleared after use
    }

    [Fact]
    public void Confirm_WithInvalidToken_ShouldReturnFalse()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);
        var wrongToken = "invalid-token";

        // Act
        var result = request.Confirm(wrongToken);

        // Assert
        result.Should().BeFalse();
        request.Status.Should().Be(DeletionRequestStatus.Pending);
        request.ConfirmedAt.Should().BeNull();
    }

    [Fact]
    public void SetUnderReview_FromConfirmed_ShouldChangeStatus()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);
        request.Confirm(request.ConfirmationToken!);

        // Act
        request.SetUnderReview("Admin reviewing the request");

        // Assert
        request.Status.Should().Be(DeletionRequestStatus.UnderReview);
        request.AdminNotes.Should().Be("Admin reviewing the request");
    }

    [Fact]
    public void Complete_ShouldSetCompletedStatus()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);
        request.Confirm(request.ConfirmationToken!);
        request.SetUnderReview("Reviewing");

        // Act
        request.Complete();

        // Assert
        request.Status.Should().Be(DeletionRequestStatus.Completed);
        request.CompletedAt.Should().NotBeNull();
        request.CompletedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Cancel_ShouldSetCancelledStatus()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);

        // Act
        request.Cancel();

        // Assert
        request.Status.Should().Be(DeletionRequestStatus.Cancelled);
    }

    [Fact]
    public void Cancel_CompletedRequest_ShouldNotChangeStatus()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);
        request.Confirm(request.ConfirmationToken!);
        request.Complete();

        // Act
        request.Cancel();

        // Assert - should still be completed
        request.Status.Should().Be(DeletionRequestStatus.Completed);
    }

    [Fact]
    public void Reject_ShouldSetRejectedStatusWithReason()
    {
        // Arrange
        var request = DeletionRequest.Create(_userId, Email, Reason);
        request.Confirm(request.ConfirmationToken!);
        var rejectReason = "Cannot delete due to outstanding payments";

        // Act
        request.Reject(rejectReason);

        // Assert
        request.Status.Should().Be(DeletionRequestStatus.Rejected);
        request.AdminNotes.Should().Be(rejectReason);
    }

    [Fact]
    public void Create_ShouldGenerateUniqueTokens()
    {
        // Act
        var request1 = DeletionRequest.Create(_userId, Email, Reason);
        var request2 = DeletionRequest.Create(_userId, Email, Reason);

        // Assert
        request1.ConfirmationToken.Should().NotBe(request2.ConfirmationToken);
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var request1 = DeletionRequest.Create(_userId, Email, Reason);
        var request2 = DeletionRequest.Create(_userId, Email, Reason);

        // Assert
        request1.Id.Should().NotBe(Guid.Empty);
        request2.Id.Should().NotBe(Guid.Empty);
        request1.Id.Should().NotBe(request2.Id);
    }
}
