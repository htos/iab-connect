using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.Finance;
using IabConnect.Application.Finance.FinanceProfiles.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Finance;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for CreateFinanceProfileCommandHandler (REQ-060)
/// </summary>
public class CreateFinanceProfileCommandHandlerTests
{
    private readonly Mock<IFinanceProfileRepository> _profileRepo = new();
    private readonly Mock<IUnitOfWork> _unitOfWork = new();
    private readonly Mock<IAuditService> _auditService = new();
    private readonly CreateFinanceProfileCommandHandler _handler;

    public CreateFinanceProfileCommandHandlerTests()
    {
        _handler = new CreateFinanceProfileCommandHandler(
            _profileRepo.Object, _unitOfWork.Object, _auditService.Object);
    }

    private static CreateFinanceProfileCommand CreateValidCommand() => new()
    {
        Jurisdiction = "CH",
        Currency = "CHF",
        FiscalYearStartMonth = 1,
        OrganizationName = "Indischer Kulturverein",
        OrganizationAddress = "Bundesplatz 1",
        OrganizationCity = "Bern",
        OrganizationPostalCode = "3011",
        OrganizationCountry = "CH",
        OrganizationEmail = "info@verein.ch",
        BankName = "PostFinance",
        BankIban = "CH93 0076 2011 6238 5295 7",
        BankBic = "POFICHBEXXX"
    };

    [Fact]
    public async Task Handle_NoExistingProfile_ShouldCreateNewProfile()
    {
        // Arrange
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        // Act
        var result = await _handler.Handle(CreateValidCommand(), CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.OrganizationName.Should().Be("Indischer Kulturverein");
        result.Jurisdiction.Should().Be("CH");
        result.Currency.Should().Be("CHF");

        _profileRepo.Verify(r => r.AddAsync(It.IsAny<FinanceProfile>(), It.IsAny<CancellationToken>()), Times.Once);
        _unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithExistingActiveProfile_ShouldDeactivateOldProfile()
    {
        // Arrange
        var existingProfile = FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Old Org", "Old Address", "Bern", "3000", "CH",
            null, null, null, null, null, null, null);

        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);
        _profileRepo.Setup(r => r.GetByIdAsync(existingProfile.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingProfile);

        // Act
        await _handler.Handle(CreateValidCommand(), CancellationToken.None);

        // Assert
        existingProfile.IsActive.Should().BeFalse();
        _profileRepo.Verify(r => r.UpdateAsync(existingProfile, It.IsAny<CancellationToken>()), Times.Once);
        _profileRepo.Verify(r => r.AddAsync(It.IsAny<FinanceProfile>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_ShouldLogAuditEvent()
    {
        // Arrange
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        // Act
        await _handler.Handle(CreateValidCommand(), CancellationToken.None);

        // Assert
        _auditService.Verify(a => a.LogActionAsync(
            AuditEventType.FinanceCreated,
            It.Is<string>(s => s.Contains("Finance profile")),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "FinanceProfile",
            It.IsAny<string?>(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_WithVatStatus_ShouldSetVatFields()
    {
        // Arrange
        _profileRepo.Setup(r => r.GetActiveProfileAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync((FinanceProfile?)null);

        var command = CreateValidCommand() with
        {
            VatStatus = "Registered",
            VatNumber = "CHE-123.456.789 MWST"
        };

        // Act
        var result = await _handler.Handle(command, CancellationToken.None);

        // Assert
        result.VatStatus.Should().Be("Registered");
        result.VatNumber.Should().Be("CHE-123.456.789 MWST");
    }
}
