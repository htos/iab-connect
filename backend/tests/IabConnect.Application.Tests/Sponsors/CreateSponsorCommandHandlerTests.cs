using FluentAssertions;
using IabConnect.Application.Common;
using IabConnect.Application.Sponsors.Commands;
using IabConnect.Domain.Sponsors;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Sponsors;

/// <summary>
/// Unit tests for CreateSponsorCommandHandler
/// REQ-031: Sponsorenverwaltung - Command Handler
/// </summary>
public class CreateSponsorCommandHandlerTests
{
    private readonly Mock<ISponsorRepository> _sponsorRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly CreateSponsorCommandHandler _handler;

    public CreateSponsorCommandHandlerTests()
    {
        _handler = new CreateSponsorCommandHandler(_sponsorRepo.Object, _unitOfWork.Object);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldReturnNewGuid()
    {
        // Arrange
        var command = CreateValidCommand();
        _sponsorRepo
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
        _sponsorRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _sponsorRepo.Verify(
            r => r.AddAsync(It.Is<Sponsor>(s => s.CompanyName == command.CompanyName), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldCallSaveChangesAsync()
    {
        // Arrange
        var command = CreateValidCommand();
        _sponsorRepo
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
        _sponsorRepo
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
        _sponsorRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        // Act
        try { await _handler.Handle(command, CancellationToken.None); } catch { }

        // Assert
        _sponsorRepo.Verify(r => r.AddAsync(It.IsAny<Sponsor>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ValidCommand_ShouldCreateSponsorWithCorrectTier()
    {
        // Arrange
        var command = CreateValidCommand();
        command = command with { Tier = SponsorTier.Platinum };
        _sponsorRepo
            .Setup(r => r.CompanyNameExistsAsync(command.CompanyName, null, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        _sponsorRepo.Verify(
            r => r.AddAsync(It.Is<Sponsor>(s => s.Tier == SponsorTier.Platinum), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    #region Helpers

    private static CreateSponsorCommand CreateValidCommand() => new()
    {
        CompanyName = "Test Corp AG",
        ContactPerson = "Max Mustermann",
        Email = "max@testcorp.ch",
        Phone = "+41 79 111 11 11",
        Website = "https://testcorp.ch",
        Tier = SponsorTier.Gold,
        Notes = "Test notes"
    };

    #endregion
}
