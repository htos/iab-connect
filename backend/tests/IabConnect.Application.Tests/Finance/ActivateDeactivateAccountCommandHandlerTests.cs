using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Accounts.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for ActivateAccountCommandHandler and DeactivateAccountCommandHandler (REQ-038)
/// </summary>
public class ActivateDeactivateAccountCommandHandlerTests
{
    private readonly Mock<IAccountRepository> _accountRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();

    private ActivateAccountCommandHandler CreateActivateHandler() =>
        new(_accountRepo.Object, _unitOfWork.Object, _auditService.Object);

    private DeactivateAccountCommandHandler CreateDeactivateHandler() =>
        new(_accountRepo.Object, _unitOfWork.Object, _auditService.Object);

    private static Account CreateAccount() =>
        Account.Create("Vereinskonto", "1000", AccountType.Bank, "Main account", 1, "admin");

    #region ActivateAccountCommand Tests

    [Fact]
    public async Task Activate_ExistingAccount_ShouldReturnActivatedDto()
    {
        // Arrange
        var account = CreateAccount();
        account.Deactivate();
        _accountRepo.Setup(r => r.GetByIdAsync(account.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        // Act
        var result = await CreateActivateHandler().Handle(
            new ActivateAccountCommand(account.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Activate_ShouldPersistAndAudit()
    {
        // Arrange
        var account = CreateAccount();
        account.Deactivate();
        _accountRepo.Setup(r => r.GetByIdAsync(account.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        // Act
        await CreateActivateHandler().Handle(
            new ActivateAccountCommand(account.Id, "admin"), CancellationToken.None);

        // Assert
        _accountRepo.Verify(r => r.UpdateAsync(account, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("activated")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Account",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Activate_NonExistentAccount_ShouldReturnNull()
    {
        // Arrange
        _accountRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Account?)null);

        // Act
        var result = await CreateActivateHandler().Handle(
            new ActivateAccountCommand(Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region DeactivateAccountCommand Tests

    [Fact]
    public async Task Deactivate_ExistingAccount_ShouldReturnDeactivatedDto()
    {
        // Arrange
        var account = CreateAccount();
        _accountRepo.Setup(r => r.GetByIdAsync(account.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        // Act
        var result = await CreateDeactivateHandler().Handle(
            new DeactivateAccountCommand(account.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task Deactivate_ShouldPersistAndAudit()
    {
        // Arrange
        var account = CreateAccount();
        _accountRepo.Setup(r => r.GetByIdAsync(account.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(account);

        // Act
        await CreateDeactivateHandler().Handle(
            new DeactivateAccountCommand(account.Id, "admin"), CancellationToken.None);

        // Assert
        _accountRepo.Verify(r => r.UpdateAsync(account, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("deactivated")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Account",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Deactivate_NonExistentAccount_ShouldReturnNull()
    {
        // Arrange
        _accountRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Account?)null);

        // Act
        var result = await CreateDeactivateHandler().Handle(
            new DeactivateAccountCommand(Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    #endregion
}
