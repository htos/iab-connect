using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for ExpenseClaim entity (REQ-067)
/// </summary>
public class ExpenseClaimTests
{
    private static readonly Guid ClaimantId = Guid.NewGuid();

    private static ExpenseClaim CreateDraftClaim(decimal amount = 150m)
        => ExpenseClaim.Create(
            "Taxi to venue", "Taxi ride for board meeting", amount,
            FinanceCurrency.CHF, DateTime.UtcNow, ClaimantId, "Max Muster", null, "admin");

    private static ExpenseClaim CreateSubmittedClaim(decimal amount = 150m)
    {
        var c = CreateDraftClaim(amount);
        c.Submit("admin");
        return c;
    }

    private static ExpenseClaim CreateReviewedClaim(decimal amount = 150m)
    {
        var c = CreateSubmittedClaim(amount);
        c.Review("kassier", "Checked receipt");
        return c;
    }

    private static ExpenseClaim CreateApprovedClaim(decimal amount = 150m)
    {
        var c = CreateReviewedClaim(amount);
        c.Approve("vorstand", "OK");
        return c;
    }

    private static ExpenseClaim CreateRejectedClaim(decimal amount = 150m)
    {
        var c = CreateSubmittedClaim(amount);
        c.Reject("kassier", "Missing receipt");
        return c;
    }

    #region Create

    [Fact]
    public void Should_Create_With_Valid_Data()
    {
        // Act
        var claim = CreateDraftClaim();

        // Assert
        claim.Title.Should().Be("Taxi to venue");
        claim.Description.Should().Be("Taxi ride for board meeting");
        claim.Amount.Should().Be(150m);
        claim.Currency.Should().Be(FinanceCurrency.CHF);
        claim.ClaimantId.Should().Be(ClaimantId);
        claim.ClaimantName.Should().Be("Max Muster");
        claim.CreatedBy.Should().Be("admin");
        claim.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Should_Set_Status_To_Draft()
    {
        // Act
        var claim = CreateDraftClaim();

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Draft);
    }

    [Fact]
    public void Should_Throw_When_Title_Empty()
    {
        // Act
        var act = () => ExpenseClaim.Create(
            "", "desc", 100m, FinanceCurrency.CHF,
            DateTime.UtcNow, ClaimantId, "Name", null, "admin");

        // Assert
        act.Should().Throw<ArgumentException>().WithParameterName("title");
    }

    [Fact]
    public void Should_Throw_When_Description_Empty()
    {
        // Act
        var act = () => ExpenseClaim.Create(
            "Title", "", 100m, FinanceCurrency.CHF,
            DateTime.UtcNow, ClaimantId, "Name", null, "admin");

        // Assert
        act.Should().Throw<ArgumentException>().WithParameterName("description");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-10)]
    public void Should_Throw_When_Amount_Zero_Or_Negative(decimal amount)
    {
        // Act
        var act = () => ExpenseClaim.Create(
            "Title", "Desc", amount, FinanceCurrency.CHF,
            DateTime.UtcNow, ClaimantId, "Name", null, "admin");

        // Assert
        act.Should().Throw<ArgumentException>().WithParameterName("amount");
    }

    [Fact]
    public void Should_Throw_When_ClaimantName_Empty()
    {
        // Act
        var act = () => ExpenseClaim.Create(
            "Title", "Desc", 100m, FinanceCurrency.CHF,
            DateTime.UtcNow, ClaimantId, "", null, "admin");

        // Assert
        act.Should().Throw<ArgumentException>().WithParameterName("claimantName");
    }

    #endregion

    #region Update

    [Fact]
    public void Should_Update_Draft_Claim()
    {
        // Arrange
        var claim = CreateDraftClaim();

        // Act
        claim.Update("New title", "New desc", 200m, DateTime.UtcNow, null, "editor");

        // Assert
        claim.Title.Should().Be("New title");
        claim.Description.Should().Be("New desc");
        claim.Amount.Should().Be(200m);
        claim.UpdatedBy.Should().Be("editor");
        claim.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Should_Throw_When_Updating_Non_Draft_Claim()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        var act = () => claim.Update("X", "Y", 50m, DateTime.UtcNow, null, "editor");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    #endregion

    #region Submit

    [Fact]
    public void Should_Submit_Draft_Claim()
    {
        // Arrange
        var claim = CreateDraftClaim();

        // Act
        claim.Submit("submitter");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Submitted);
        claim.UpdatedBy.Should().Be("submitter");
    }

    [Fact]
    public void Should_Throw_When_Submitting_Non_Draft_Claim()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        var act = () => claim.Submit("submitter");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    #endregion

    #region Review

    [Fact]
    public void Should_Review_Submitted_Claim()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        claim.Review("kassier", "Receipt OK");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.UnderReview);
    }

    [Fact]
    public void Should_Set_ReviewedBy_And_ReviewedAt()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        claim.Review("kassier", "All fine");

        // Assert
        claim.ReviewedBy.Should().Be("kassier");
        claim.ReviewedAt.Should().NotBeNull();
        claim.ReviewComment.Should().Be("All fine");
    }

    [Fact]
    public void Should_Throw_When_Reviewing_Non_Submitted_Claim()
    {
        // Arrange
        var claim = CreateDraftClaim();

        // Act
        var act = () => claim.Review("kassier");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*submitted*");
    }

    #endregion

    #region Approve

    [Fact]
    public void Should_Approve_Reviewed_Claim()
    {
        // Arrange
        var claim = CreateReviewedClaim();

        // Act
        claim.Approve("vorstand", "Approved");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Approved);
    }

    [Fact]
    public void Should_Set_ApprovedBy_And_ApprovedAt()
    {
        // Arrange
        var claim = CreateReviewedClaim();

        // Act
        claim.Approve("vorstand", "Go ahead");

        // Assert
        claim.ApprovedBy.Should().Be("vorstand");
        claim.ApprovedAt.Should().NotBeNull();
        claim.ApprovalComment.Should().Be("Go ahead");
    }

    [Fact]
    public void Should_Throw_When_Approving_Non_Reviewed_Claim()
    {
        // Arrange – still in Submitted status
        var claim = CreateSubmittedClaim();

        // Act
        var act = () => claim.Approve("vorstand");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*review*");
    }

    #endregion

    #region Reject

    [Fact]
    public void Should_Reject_Submitted_Claim()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        claim.Reject("kassier", "No receipt attached");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Rejected);
        claim.RejectedBy.Should().Be("kassier");
        claim.RejectionReason.Should().Be("No receipt attached");
    }

    [Fact]
    public void Should_Reject_Reviewed_Claim()
    {
        // Arrange
        var claim = CreateReviewedClaim();

        // Act
        claim.Reject("vorstand", "Duplicate claim");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Rejected);
    }

    [Fact]
    public void Should_Throw_When_Rejecting_Draft_Claim()
    {
        // Arrange
        var claim = CreateDraftClaim();

        // Act
        var act = () => claim.Reject("kassier", "Reason");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*submitted or reviewed*");
    }

    [Fact]
    public void Should_Throw_When_Rejection_Reason_Empty()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act & Assert
        var act = () => claim.Reject("kassier", "");
        act.Should().Throw<ArgumentException>().WithParameterName("reason");

        var act2 = () => claim.Reject("kassier", "   ");
        act2.Should().Throw<ArgumentException>().WithParameterName("reason");
    }

    #endregion

    #region Reimburse

    [Fact]
    public void Should_Reimburse_Approved_Claim()
    {
        // Arrange
        var claim = CreateApprovedClaim();
        var paymentId = Guid.NewGuid();

        // Act
        claim.Reimburse(paymentId, "kassier");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Reimbursed);
    }

    [Fact]
    public void Should_Set_PaymentId_And_ReimbursedAt()
    {
        // Arrange
        var claim = CreateApprovedClaim();
        var paymentId = Guid.NewGuid();

        // Act
        claim.Reimburse(paymentId, "kassier");

        // Assert
        claim.PaymentId.Should().Be(paymentId);
        claim.ReimbursedAt.Should().NotBeNull();
        claim.ReimbursedBy.Should().Be("kassier");
    }

    [Fact]
    public void Should_Throw_When_Reimbursing_Non_Approved_Claim()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        var act = () => claim.Reimburse(Guid.NewGuid(), "kassier");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*approved*");
    }

    #endregion

    #region ResetToDraft

    [Fact]
    public void Should_Reset_Rejected_Claim_To_Draft()
    {
        // Arrange
        var claim = CreateRejectedClaim();

        // Act
        claim.ResetToDraft("editor");

        // Assert
        claim.Status.Should().Be(ExpenseClaimStatus.Draft);
    }

    [Fact]
    public void Should_Clear_Rejection_And_Review_Fields()
    {
        // Arrange
        var claim = CreateRejectedClaim();

        // Act
        claim.ResetToDraft("editor");

        // Assert
        claim.RejectedBy.Should().BeNull();
        claim.RejectedAt.Should().BeNull();
        claim.RejectionReason.Should().BeNull();
        claim.ReviewedBy.Should().BeNull();
        claim.ReviewedAt.Should().BeNull();
        claim.ReviewComment.Should().BeNull();
        claim.UpdatedBy.Should().Be("editor");
    }

    [Fact]
    public void Should_Throw_When_Resetting_Non_Rejected_Claim()
    {
        // Arrange
        var claim = CreateSubmittedClaim();

        // Act
        var act = () => claim.ResetToDraft("editor");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*rejected*");
    }

    #endregion

    #region SoftDelete

    [Fact]
    public void Should_SoftDelete_Claim()
    {
        // Arrange
        var claim = CreateDraftClaim();

        // Act
        claim.SoftDelete("admin");

        // Assert
        claim.IsDeleted.Should().BeTrue();
        claim.DeletedAt.Should().NotBeNull();
        claim.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Should_Restore_Claim()
    {
        // Arrange
        var claim = CreateDraftClaim();
        claim.SoftDelete("admin");

        // Act
        claim.Restore();

        // Assert
        claim.IsDeleted.Should().BeFalse();
        claim.DeletedAt.Should().BeNull();
        claim.DeletedBy.Should().BeNull();
    }

    #endregion
}
