using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Payment approval workflow (REQ-067)
/// </summary>
public class PaymentApprovalTests
{
    private static Payment CreateDraftPayment(decimal amount = 100m)
        => Payment.Create(DateTime.UtcNow, amount, PaymentDirection.Expense, PaymentMethod.Transfer, "REF-001", null, null, null, "admin");

    private static Payment CreateSubmittedPayment(decimal amount = 100m)
    {
        var p = CreateDraftPayment(amount);
        p.Submit("admin");
        return p;
    }

    private static Payment CreateApprovedPayment(decimal amount = 100m)
    {
        var p = CreateSubmittedPayment(amount);
        p.Approve("treasurer", "Looks good");
        return p;
    }

    private static Payment CreateRejectedPayment(decimal amount = 100m)
    {
        var p = CreateSubmittedPayment(amount);
        p.Reject("treasurer", "Not justified");
        return p;
    }

    #region Submit

    [Fact]
    public void Should_Submit_Draft_Payment()
    {
        // Arrange
        var payment = CreateDraftPayment();

        // Act
        payment.Submit("submitter");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Submitted);
        payment.UpdatedBy.Should().Be("submitter");
        payment.UpdatedAt.Should().NotBeNull();
    }

    [Theory]
    [InlineData(PaymentStatus.Submitted)]
    [InlineData(PaymentStatus.Approved)]
    [InlineData(PaymentStatus.Rejected)]
    [InlineData(PaymentStatus.Paid)]
    public void Should_Throw_When_Submitting_Non_Draft_Payment(PaymentStatus targetStatus)
    {
        // Arrange
        var payment = CreateDraftPayment();
        // Advance to the target status
        switch (targetStatus)
        {
            case PaymentStatus.Submitted:
                payment.Submit("admin");
                break;
            case PaymentStatus.Approved:
                payment.Submit("admin");
                payment.Approve("treasurer");
                break;
            case PaymentStatus.Rejected:
                payment.Submit("admin");
                payment.Reject("treasurer", "No");
                break;
            case PaymentStatus.Paid:
                payment.MarkAsPaid("admin");
                break;
        }

        // Act
        var act = () => payment.Submit("submitter");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    #endregion

    #region Approve

    [Fact]
    public void Should_Approve_Submitted_Payment()
    {
        // Arrange
        var payment = CreateSubmittedPayment();

        // Act
        payment.Approve("treasurer", "Approved");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Approved);
    }

    [Fact]
    public void Should_Set_ApprovedBy_And_ApprovedAt()
    {
        // Arrange
        var payment = CreateSubmittedPayment();

        // Act
        payment.Approve("treasurer", "All good");

        // Assert
        payment.ApprovedBy.Should().Be("treasurer");
        payment.ApprovedAt.Should().NotBeNull();
        payment.ApprovalComment.Should().Be("All good");
        payment.UpdatedBy.Should().Be("treasurer");
    }

    [Theory]
    [InlineData(PaymentStatus.Draft)]
    [InlineData(PaymentStatus.Approved)]
    [InlineData(PaymentStatus.Rejected)]
    [InlineData(PaymentStatus.Paid)]
    public void Should_Throw_When_Approving_Non_Submitted_Payment(PaymentStatus targetStatus)
    {
        // Arrange – create a payment already in the given status
        var payment = CreateDraftPayment();
        switch (targetStatus)
        {
            case PaymentStatus.Draft:
                break; // already Draft
            case PaymentStatus.Approved:
                payment.Submit("admin");
                payment.Approve("treasurer");
                break;
            case PaymentStatus.Rejected:
                payment.Submit("admin");
                payment.Reject("treasurer", "No");
                break;
            case PaymentStatus.Paid:
                payment.MarkAsPaid("admin");
                break;
        }

        // Act
        var act = () => payment.Approve("treasurer");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*submitted*");
    }

    #endregion

    #region Reject

    [Fact]
    public void Should_Reject_Submitted_Payment()
    {
        // Arrange
        var payment = CreateSubmittedPayment();

        // Act
        payment.Reject("treasurer", "Budget exceeded");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Rejected);
        payment.RejectedBy.Should().Be("treasurer");
        payment.RejectedAt.Should().NotBeNull();
        payment.RejectionReason.Should().Be("Budget exceeded");
    }

    [Fact]
    public void Should_Throw_When_Rejecting_Non_Submitted_Payment()
    {
        // Arrange
        var payment = CreateDraftPayment();

        // Act
        var act = () => payment.Reject("treasurer", "No reason");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*submitted*");
    }

    [Fact]
    public void Should_Throw_When_Rejection_Reason_Empty()
    {
        // Arrange
        var payment = CreateSubmittedPayment();

        // Act & Assert
        var act1 = () => payment.Reject("treasurer", "");
        act1.Should().Throw<ArgumentException>()
            .WithParameterName("reason");

        var act2 = () => payment.Reject("treasurer", "   ");
        act2.Should().Throw<ArgumentException>()
            .WithParameterName("reason");
    }

    #endregion

    #region MarkAsPaid

    [Fact]
    public void Should_Mark_Approved_Payment_As_Paid()
    {
        // Arrange
        var payment = CreateApprovedPayment();

        // Act
        payment.MarkAsPaid("admin");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Paid);
        payment.UpdatedBy.Should().Be("admin");
    }

    [Fact]
    public void Should_Mark_Draft_Payment_As_Paid()
    {
        // Arrange – small amount, no approval needed, still Draft
        var payment = CreateDraftPayment(10m);

        // Act
        payment.MarkAsPaid("admin");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Paid);
    }

    [Fact]
    public void Should_Throw_When_Marking_Submitted_Payment_As_Paid()
    {
        // Arrange
        var payment = CreateSubmittedPayment();

        // Act
        var act = () => payment.MarkAsPaid("admin");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*approved or draft*");
    }

    #endregion

    #region ResetToDraft

    [Fact]
    public void Should_Reset_Rejected_Payment_To_Draft()
    {
        // Arrange
        var payment = CreateRejectedPayment();

        // Act
        payment.ResetToDraft("editor");

        // Assert
        payment.Status.Should().Be(PaymentStatus.Draft);
        payment.RejectedBy.Should().BeNull();
        payment.RejectedAt.Should().BeNull();
        payment.RejectionReason.Should().BeNull();
        payment.UpdatedBy.Should().Be("editor");
    }

    [Theory]
    [InlineData(PaymentStatus.Draft)]
    [InlineData(PaymentStatus.Submitted)]
    [InlineData(PaymentStatus.Approved)]
    [InlineData(PaymentStatus.Paid)]
    public void Should_Throw_When_Resetting_Non_Rejected_Payment(PaymentStatus targetStatus)
    {
        // Arrange
        var payment = CreateDraftPayment();
        switch (targetStatus)
        {
            case PaymentStatus.Draft:
                break;
            case PaymentStatus.Submitted:
                payment.Submit("admin");
                break;
            case PaymentStatus.Approved:
                payment.Submit("admin");
                payment.Approve("treasurer");
                break;
            case PaymentStatus.Paid:
                payment.MarkAsPaid("admin");
                break;
        }

        // Act
        var act = () => payment.ResetToDraft("editor");

        // Assert
        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*rejected*");
    }

    #endregion

    #region RequiresApproval

    [Fact]
    public void Should_Return_True_When_Amount_Exceeds_CHF_Threshold()
    {
        // Arrange
        var payment = CreateDraftPayment(500m);

        // Act
        var result = payment.RequiresApproval(200m, 180m, FinanceCurrency.CHF);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void Should_Return_True_When_Amount_Exceeds_EUR_Threshold()
    {
        // Arrange
        var payment = CreateDraftPayment(500m);

        // Act
        var result = payment.RequiresApproval(200m, 180m, FinanceCurrency.EUR);

        // Assert
        result.Should().BeTrue();
    }

    [Fact]
    public void Should_Return_False_When_Below_Threshold()
    {
        // Arrange
        var payment = CreateDraftPayment(50m);

        // Act
        var result = payment.RequiresApproval(200m, 180m, FinanceCurrency.CHF);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public void Should_Return_False_When_No_Threshold_Set()
    {
        // Arrange
        var payment = CreateDraftPayment(5000m);

        // Act
        var result = payment.RequiresApproval(null, null, FinanceCurrency.CHF);

        // Assert
        result.Should().BeFalse();
    }

    #endregion
}
