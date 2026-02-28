using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.BankImports.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for UnmatchBankImportItemCommandHandler (REQ-041)
/// </summary>
public class UnmatchBankImportItemCommandHandlerTests
{
    private readonly Mock<IBankImportRepository> _bankImportRepo = new();
    private readonly Mock<IPaymentRepository> _paymentRepo = new();
    private readonly Mock<ITransactionRepository> _transactionRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly UnmatchBankImportItemCommandHandler _handler;

    public UnmatchBankImportItemCommandHandlerTests()
    {
        _handler = new UnmatchBankImportItemCommandHandler(
            _bankImportRepo.Object, _paymentRepo.Object, _transactionRepo.Object,
            _unitOfWork.Object, _auditService.Object);
    }

    private static (BankImport import, BankImportItem item, Guid paymentId) CreateMatchedBankImport()
    {
        var import = BankImport.Create("export.csv", "admin");
        var item = BankImportItem.Create(import.Id, DateTime.UtcNow, "Payment from member", 100m, "CH93 0076", "REF-001");
        import.AddItem(item);

        var paymentId = Guid.NewGuid();
        item.MatchToPayment(paymentId);

        return (import, item, paymentId);
    }

    [Fact]
    public async Task Handle_MatchedItem_ShouldUnmatchSuccessfully()
    {
        // Arrange
        var (import, item, paymentId) = CreateMatchedBankImport();
        _bankImportRepo.Setup(r => r.GetByIdAsync(import.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(import);
        _paymentRepo.Setup(r => r.GetByIdAsync(paymentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        // Act
        var result = await _handler.Handle(
            new UnmatchBankImportItemCommand(import.Id, item.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.Status.Should().Be("Unmatched");
        result.MatchedPaymentId.Should().BeNull();
    }

    [Fact]
    public async Task Handle_ShouldPersistChanges()
    {
        // Arrange
        var (import, item, paymentId) = CreateMatchedBankImport();
        _bankImportRepo.Setup(r => r.GetByIdAsync(import.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(import);
        _paymentRepo.Setup(r => r.GetByIdAsync(paymentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        // Act
        await _handler.Handle(
            new UnmatchBankImportItemCommand(import.Id, item.Id, "admin"), CancellationToken.None);

        // Assert
        _bankImportRepo.Verify(r => r.UpdateAsync(import, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithLinkedPaymentAndTransaction_ShouldDeleteTransaction()
    {
        // Arrange
        var (import, item, _) = CreateMatchedBankImport();
        var transactionId = Guid.NewGuid();
        var payment = Payment.Create(DateTime.UtcNow, 100m, PaymentDirection.Income,
            PaymentMethod.Transfer, "REF-001", null, transactionId, null, "admin");
        var paymentId = item.MatchedPaymentId!.Value;

        _bankImportRepo.Setup(r => r.GetByIdAsync(import.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(import);
        _paymentRepo.Setup(r => r.GetByIdAsync(paymentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(payment);

        // Act
        await _handler.Handle(
            new UnmatchBankImportItemCommand(import.Id, item.Id, "admin"), CancellationToken.None);

        // Assert
        _transactionRepo.Verify(r => r.DeleteAsync(transactionId, It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        var (import, item, paymentId) = CreateMatchedBankImport();
        _bankImportRepo.Setup(r => r.GetByIdAsync(import.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(import);
        _paymentRepo.Setup(r => r.GetByIdAsync(paymentId, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Payment?)null);

        // Act
        await _handler.Handle(
            new UnmatchBankImportItemCommand(import.Id, item.Id, "admin"), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("unmatched")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "BankImportItem",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NonExistentBankImport_ShouldReturnNull()
    {
        // Arrange
        _bankImportRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((BankImport?)null);

        // Act
        var result = await _handler.Handle(
            new UnmatchBankImportItemCommand(Guid.NewGuid(), Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_NonExistentItem_ShouldReturnNull()
    {
        // Arrange
        var import = BankImport.Create("export.csv", "admin");
        _bankImportRepo.Setup(r => r.GetByIdAsync(import.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(import);

        // Act
        var result = await _handler.Handle(
            new UnmatchBankImportItemCommand(import.Id, Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    [Fact]
    public async Task Handle_UnmatchedItem_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var import = BankImport.Create("export.csv", "admin");
        var item = BankImportItem.Create(import.Id, DateTime.UtcNow, "Some payment", 50m, null, null);
        import.AddItem(item);

        _bankImportRepo.Setup(r => r.GetByIdAsync(import.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(import);

        // Act & Assert
        var act = () => _handler.Handle(
            new UnmatchBankImportItemCommand(import.Id, item.Id, "admin"), CancellationToken.None);
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*matched*");
    }
}
