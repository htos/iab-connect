using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.Categories.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for ActivateCategoryCommandHandler and DeactivateCategoryCommandHandler (REQ-038)
/// </summary>
public class ActivateDeactivateCategoryCommandHandlerTests
{
    private readonly Mock<ICategoryRepository> _categoryRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();

    private ActivateCategoryCommandHandler CreateActivateHandler() =>
        new(_categoryRepo.Object, _unitOfWork.Object, _auditService.Object);

    private DeactivateCategoryCommandHandler CreateDeactivateHandler() =>
        new(_categoryRepo.Object, _unitOfWork.Object, _auditService.Object);

    private static Category CreateCategory() =>
        Category.Create("Mitgliedsbeiträge", TransactionType.Income, "#22c55e", "admin");

    #region ActivateCategoryCommand Tests

    [Fact]
    public async Task Activate_ExistingCategory_ShouldReturnActivatedDto()
    {
        // Arrange
        var category = CreateCategory();
        category.Deactivate();
        _categoryRepo.Setup(r => r.GetByIdAsync(category.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        // Act
        var result = await CreateActivateHandler().Handle(
            new ActivateCategoryCommand(category.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.IsActive.Should().BeTrue();
    }

    [Fact]
    public async Task Activate_ShouldPersistAndAudit()
    {
        // Arrange
        var category = CreateCategory();
        category.Deactivate();
        _categoryRepo.Setup(r => r.GetByIdAsync(category.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        // Act
        await CreateActivateHandler().Handle(
            new ActivateCategoryCommand(category.Id, "admin"), CancellationToken.None);

        // Assert
        _categoryRepo.Verify(r => r.UpdateAsync(category, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("activated")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Category",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Activate_NonExistentCategory_ShouldReturnNull()
    {
        // Arrange
        _categoryRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        // Act
        var result = await CreateActivateHandler().Handle(
            new ActivateCategoryCommand(Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    #endregion

    #region DeactivateCategoryCommand Tests

    [Fact]
    public async Task Deactivate_ExistingCategory_ShouldReturnDeactivatedDto()
    {
        // Arrange
        var category = CreateCategory();
        _categoryRepo.Setup(r => r.GetByIdAsync(category.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        // Act
        var result = await CreateDeactivateHandler().Handle(
            new DeactivateCategoryCommand(category.Id, "admin"), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result!.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task Deactivate_ShouldPersistAndAudit()
    {
        // Arrange
        var category = CreateCategory();
        _categoryRepo.Setup(r => r.GetByIdAsync(category.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(category);

        // Act
        await CreateDeactivateHandler().Handle(
            new DeactivateCategoryCommand(category.Id, "admin"), CancellationToken.None);

        // Assert
        _categoryRepo.Verify(r => r.UpdateAsync(category, It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceUpdated,
            It.Is<string>(s => s.Contains("deactivated")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "Category",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Deactivate_NonExistentCategory_ShouldReturnNull()
    {
        // Arrange
        _categoryRepo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((Category?)null);

        // Act
        var result = await CreateDeactivateHandler().Handle(
            new DeactivateCategoryCommand(Guid.NewGuid(), "admin"), CancellationToken.None);

        // Assert
        result.Should().BeNull();
    }

    #endregion
}
