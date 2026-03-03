using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Application.Sponsors.Commands;
using IabConnect.Domain.Sponsors;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Sponsors;

/// <summary>
/// Unit tests for CreateSupplierCommandHandler
/// REQ-032: Lieferantenverwaltung - Command Handler
/// </summary>
public class CreateSupplierCommandHandlerTests
{
    private readonly Mock<ISupplierRepository> _supplierRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly CreateSupplierCommandHandler _handler;

    public CreateSupplierCommandHandlerTests()
    {
        _handler = new CreateSupplierCommandHandler(_supplierRepo.Object, _unitOfWork.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldReturnNewGuid()
    {
        // Arrange
        var command = CreateValidCommand();
        _supplierRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldCallAddAsync()
    {
        // Arrange
        var command = CreateValidCommand();
        _supplierRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _supplierRepo.Verify(
            r => r.AddAsync(It.Is<Supplier>(s => s.CompanyName == command.CompanyName), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldCallSaveChangesAsync()
    {
        // Arrange
        var command = CreateValidCommand();
        _supplierRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_DuplicateCompanyName_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var command = CreateValidCommand();
        _supplierRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        var act = () => _handler.Handle(command, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*company name*");
    }

    [Fact]
    public async Task Handle_DuplicateCompanyName_ShouldNotCallAddAsync()
    {
        // Arrange
        var command = CreateValidCommand();
        _supplierRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        try { await _handler.Handle(command, CancellationToken.None); } catch { }

        // Assert
        _supplierRepo.Verify(r => r.AddAsync(It.IsAny<Supplier>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldCreateSupplierWithCorrectCategory()
    {
        // Arrange
        var command = CreateValidCommand();
        _supplierRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _supplierRepo.Verify(
            r => r.AddAsync(It.Is<Supplier>(s => s.Category == "Catering"), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    #region Helpers

    private static CreateSupplierCommand CreateValidCommand() => new()
    {
        CompanyName = "Test Catering AG",
        ContactPerson = "Anna Meier",
        Email = "anna@catering.ch",
        Phone = "+41 79 333 33 33",
        Website = "https://catering.ch",
        Category = "Catering",
        Notes = "Test notes"
    };

    #endregion
}
