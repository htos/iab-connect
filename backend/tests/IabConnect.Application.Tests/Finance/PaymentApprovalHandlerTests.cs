using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Payments.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Payment approval command handlers (REQ-067)
/// </summary>
public class PaymentApprovalHandlerTests
{
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<IFinanceProfileRepository> _profileRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly Mock<IFiscalPeriodService> _fiscalPeriodService = new();
    private readonly Mock<IAutoBookingService> _autoBookingService = new();

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
        p.Approve("treasurer");
        return p;
    }

    private static FinanceProfile CreateProfile(decimal? thresholdChf = 200m, decimal? thresholdEur = 180m)
        => FinanceProfile.Create(
            Jurisdiction.CH, "CH", FinanceCurrency.CHF, 1,
            "Verein", "Str 1", "Zürich", "8000", "CH",
            null, null, null, null, null, null, null,
            VatStatus.NotRegistered, null,
            thresholdChf, thresholdEur);

    #region SubmitPaymentCommandHandler

    [Fact]
    public async Task Submit_Should_Submit_Payment()
    {
        // Arrange
        var payment = CreateDraftPayment();
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = new SubmitPaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        await handler.Handle(new SubmitPaymentCommand(payment.Id, "submitter"), CancellationToken.None);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Submitted);
        _paymentRepo.Verify(r => r.UpdateAsync(payment, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Submit_Should_Throw_When_Not_Found()
    {
        // Arrange
        _paymentRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var handler = new SubmitPaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        var act = () => handler.Handle(
            new SubmitPaymentCommand(Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not found*");
    }

    [Fact]
    public async Task Submit_Should_Audit_Submit_Action()
    {
        // Arrange
        var payment = CreateDraftPayment();
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = new SubmitPaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        await handler.Handle(new SubmitPaymentCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("submitted")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Payment",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    #endregion

    #region ApprovePaymentCommandHandler

    [Fact]
    public async Task Approve_Should_Approve_Payment()
    {
        // Arrange
        var payment = CreateSubmittedPayment();
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = new ApprovePaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        await handler.Handle(
            new ApprovePaymentCommand(payment.Id, "Looks good", "treasurer"), CancellationToken.None);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Approved);
        payment.ApprovedBy.Should().Be("treasurer");
        _paymentRepo.Verify(r => r.UpdateAsync(payment, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Approve_Should_Throw_When_Not_Found()
    {
        // Arrange
        _paymentRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var handler = new ApprovePaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        var act = () => handler.Handle(
            new ApprovePaymentCommand(Guid.NewGuid(), null, "treasurer"), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not found*");
    }

    #endregion

    #region RejectPaymentCommandHandler

    [Fact]
    public async Task Reject_Should_Reject_Payment()
    {
        // Arrange
        var payment = CreateSubmittedPayment();
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var handler = new RejectPaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        await handler.Handle(
            new RejectPaymentCommand(payment.Id, "Not justified", "treasurer"), CancellationToken.None);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Rejected);
        payment.RejectionReason.Should().Be("Not justified");
        _paymentRepo.Verify(r => r.UpdateAsync(payment, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Reject_Should_Throw_When_Not_Found()
    {
        // Arrange
        _paymentRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        var handler = new RejectPaymentCommandHandler(
            _paymentRepo.Object, _unitOfWork.Object, _auditService.Object);

        // Act
        var act = () => handler.Handle(
            new RejectPaymentCommand(Guid.NewGuid(), "Reason", "treasurer"), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*not found*");
    }

    #endregion

    #region MarkPaymentAsPaidCommandHandler

    [Fact]
    public async Task MarkAsPaid_Should_Mark_As_Paid_When_No_Approval_Required()
    {
        // Arrange – amount below threshold, Draft status is fine
        var payment = CreateDraftPayment(50m);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var profile = CreateProfile(thresholdChf: 200m);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _fiscalPeriodService.Setup(s => s.EnsurePeriodNotLockedAsync(
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new MarkPaymentAsPaidCommandHandler(
            _paymentRepo.Object, _profileRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object,
            _autoBookingService.Object);

        // Act
        await handler.Handle(new MarkPaymentAsPaidCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Paid);
        _paymentRepo.Verify(r => r.UpdateAsync(payment, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task MarkAsPaid_Should_Mark_As_Paid_When_Approved()
    {
        // Arrange – amount above threshold but already Approved
        var payment = CreateApprovedPayment(500m);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var profile = CreateProfile(thresholdChf: 200m);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _fiscalPeriodService.Setup(s => s.EnsurePeriodNotLockedAsync(
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new MarkPaymentAsPaidCommandHandler(
            _paymentRepo.Object, _profileRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object,
            _autoBookingService.Object);

        // Act
        await handler.Handle(new MarkPaymentAsPaidCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        payment.Status.Should().Be(PaymentStatus.Paid);
    }

    [Fact]
    public async Task MarkAsPaid_Should_Throw_When_Approval_Required_But_Not_Approved()
    {
        // Arrange – amount above threshold, still Draft → handler should block
        var payment = CreateDraftPayment(500m);
        _paymentRepo.Setup(r => r.GetByIdAsync(payment.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        var profile = CreateProfile(thresholdChf: 200m);
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(profile);

        _fiscalPeriodService.Setup(s => s.EnsurePeriodNotLockedAsync(
            It.IsAny<DateTime>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new MarkPaymentAsPaidCommandHandler(
            _paymentRepo.Object, _profileRepo.Object,
            _unitOfWork.Object, _auditService.Object, _fiscalPeriodService.Object,
            _autoBookingService.Object);

        // Act
        var act = () => handler.Handle(
            new MarkPaymentAsPaidCommand(payment.Id, "admin"), CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*requires approval*");
    }

    #endregion
}
