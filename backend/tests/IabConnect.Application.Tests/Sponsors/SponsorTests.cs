using FluentAssertions;
using IabConnect.Domain.Sponsors;
using Xunit;

namespace IabConnect.Application.Tests.Sponsors;

/// <summary>
/// Unit tests for Sponsor aggregate root
/// REQ-031: Sponsorenverwaltung
/// </summary>
public class SponsorTests
{
    #region Create Tests

    [Fact]
    public void Create_NewSponsor_ShouldSetAllProperties()
    {
        // Arrange & Act
        var sponsor = Sponsor.Create(
            "ACME Corp",
            "John Doe",
            "john@acme.com",
            "+41 79 111 11 11",
            "https://acme.com",
            "Hauptstrasse 1",
            "Bern",
            "3000",
            "Schweiz",
            SponsorTier.Gold,
            "Important sponsor",
            DateOnly.FromDateTime(new DateTime(2026, 1, 1)),
            DateOnly.FromDateTime(new DateTime(2026, 12, 31)));

        // Assert
        sponsor.CompanyName.Should().Be("ACME Corp");
        sponsor.ContactPerson.Should().Be("John Doe");
        sponsor.Email.Should().Be("john@acme.com");
        sponsor.Phone.Should().Be("+41 79 111 11 11");
        sponsor.Website.Should().Be("https://acme.com");
        sponsor.Street.Should().Be("Hauptstrasse 1");
        sponsor.City.Should().Be("Bern");
        sponsor.PostalCode.Should().Be("3000");
        sponsor.Country.Should().Be("Schweiz");
        sponsor.Tier.Should().Be(SponsorTier.Gold);
        sponsor.Notes.Should().Be("Important sponsor");
        sponsor.AgreementStart.Should().Be(DateOnly.FromDateTime(new DateTime(2026, 1, 1)));
        sponsor.AgreementEnd.Should().Be(DateOnly.FromDateTime(new DateTime(2026, 12, 31)));
    }

    [Fact]
    public void Create_NewSponsor_ShouldSetStatusToProspect()
    {
        // Arrange & Act
        var sponsor = CreateTestSponsor();

        // Assert
        sponsor.Status.Should().Be(SponsorStatus.Prospect);
    }

    [Fact]
    public void Create_NewSponsor_ShouldGenerateNewId()
    {
        // Arrange & Act
        var sponsor = CreateTestSponsor();

        // Assert
        sponsor.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_NewSponsor_ShouldRaiseSponsorCreatedEvent()
    {
        // Arrange & Act
        var sponsor = CreateTestSponsor();

        // Assert
        sponsor.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<SponsorCreatedEvent>();
    }

    [Fact]
    public void Create_TwoSponsors_ShouldHaveDifferentIds()
    {
        // Arrange & Act
        var sponsor1 = CreateTestSponsor();
        var sponsor2 = CreateTestSponsor();

        // Assert
        sponsor1.Id.Should().NotBe(sponsor2.Id);
    }

    [Theory]
    [InlineData(SponsorTier.Bronze)]
    [InlineData(SponsorTier.Silver)]
    [InlineData(SponsorTier.Gold)]
    [InlineData(SponsorTier.Platinum)]
    public void Create_WithDifferentTiers_ShouldSetCorrectTier(SponsorTier tier)
    {
        // Arrange & Act
        var sponsor = Sponsor.Create("Company", null, null, null, null, null, null, null, null, tier, null, null, null);

        // Assert
        sponsor.Tier.Should().Be(tier);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ExistingSponsor_ShouldUpdateAllProperties()
    {
        // Arrange
        var sponsor = CreateTestSponsor();

        // Act
        sponsor.Update(
            "Updated Corp",
            "Jane Smith",
            "jane@updated.com",
            "+41 79 222 22 22",
            "https://updated.com",
            "Neue Strasse 2",
            "Zürich",
            "8000",
            "Deutschland",
            SponsorTier.Platinum,
            "Updated notes",
            DateOnly.FromDateTime(new DateTime(2027, 1, 1)),
            DateOnly.FromDateTime(new DateTime(2027, 12, 31)));

        // Assert
        sponsor.CompanyName.Should().Be("Updated Corp");
        sponsor.ContactPerson.Should().Be("Jane Smith");
        sponsor.Email.Should().Be("jane@updated.com");
        sponsor.Phone.Should().Be("+41 79 222 22 22");
        sponsor.Website.Should().Be("https://updated.com");
        sponsor.Street.Should().Be("Neue Strasse 2");
        sponsor.City.Should().Be("Zürich");
        sponsor.PostalCode.Should().Be("8000");
        sponsor.Country.Should().Be("Deutschland");
        sponsor.Tier.Should().Be(SponsorTier.Platinum);
        sponsor.Notes.Should().Be("Updated notes");
    }

    #endregion

    #region Status Transition Tests

    [Fact]
    public void Activate_Sponsor_ShouldSetStatusToActive()
    {
        // Arrange
        var sponsor = CreateTestSponsor();

        // Act
        sponsor.Activate();

        // Assert
        sponsor.Status.Should().Be(SponsorStatus.Active);
    }

    [Fact]
    public void Activate_Sponsor_ShouldRaiseStatusChangedEvent()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        sponsor.ClearDomainEvents();

        // Act
        sponsor.Activate();

        // Assert
        sponsor.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<SponsorStatusChangedEvent>();
    }

    [Fact]
    public void Pause_Sponsor_ShouldSetStatusToPaused()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        sponsor.Activate();

        // Act
        sponsor.Pause();

        // Assert
        sponsor.Status.Should().Be(SponsorStatus.Paused);
    }

    [Fact]
    public void End_Sponsor_ShouldSetStatusToEnded()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        sponsor.Activate();

        // Act
        sponsor.End();

        // Assert
        sponsor.Status.Should().Be(SponsorStatus.Ended);
    }

    #endregion

    #region Package Management Tests

    [Fact]
    public void AddPackage_ShouldAddToPackagesList()
    {
        // Arrange
        var sponsor = CreateTestSponsor();

        // Act
        var package = sponsor.AddPackage("Gold Package", "Premium benefits", 5000m, "CHF");

        // Assert
        sponsor.Packages.Should().HaveCount(1);
        package.Name.Should().Be("Gold Package");
        package.Description.Should().Be("Premium benefits");
        package.Amount.Should().Be(5000m);
        package.Currency.Should().Be("CHF");
    }

    [Fact]
    public void AddPackage_MultipleTimes_ShouldAddAll()
    {
        // Arrange
        var sponsor = CreateTestSponsor();

        // Act
        sponsor.AddPackage("Package 1", null, 1000m, "CHF");
        sponsor.AddPackage("Package 2", null, 2000m, "EUR");

        // Assert
        sponsor.Packages.Should().HaveCount(2);
    }

    [Fact]
    public void RemovePackage_ExistingPackage_ShouldRemoveFromList()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        var package = sponsor.AddPackage("Test Package", null, 1000m, "CHF");

        // Act
        sponsor.RemovePackage(package.Id);

        // Assert
        sponsor.Packages.Should().BeEmpty();
    }

    [Fact]
    public void RemovePackage_NonExistingId_ShouldDoNothing()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        sponsor.AddPackage("Test Package", null, 1000m, "CHF");

        // Act
        sponsor.RemovePackage(Guid.NewGuid());

        // Assert
        sponsor.Packages.Should().HaveCount(1);
    }

    #endregion

    #region ContractLink Management Tests

    [Fact]
    public void AddContractLink_ShouldAddToLinksList()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        var targetId = Guid.NewGuid();

        // Act
        var link = sponsor.AddContractLink(ContractLinkType.Document, targetId, "Main contract");

        // Assert
        sponsor.ContractLinks.Should().HaveCount(1);
        link.LinkType.Should().Be(ContractLinkType.Document);
        link.TargetId.Should().Be(targetId);
        link.Description.Should().Be("Main contract");
    }

    [Fact]
    public void RemoveContractLink_ExistingLink_ShouldRemoveFromList()
    {
        // Arrange
        var sponsor = CreateTestSponsor();
        var link = sponsor.AddContractLink(ContractLinkType.Invoice, Guid.NewGuid(), null);

        // Act
        sponsor.RemoveContractLink(link.Id);

        // Assert
        sponsor.ContractLinks.Should().BeEmpty();
    }

    [Theory]
    [InlineData(ContractLinkType.Document)]
    [InlineData(ContractLinkType.Invoice)]
    [InlineData(ContractLinkType.Event)]
    public void AddContractLink_WithDifferentTypes_ShouldSetCorrectType(ContractLinkType linkType)
    {
        // Arrange
        var sponsor = CreateTestSponsor();

        // Act
        var link = sponsor.AddContractLink(linkType, Guid.NewGuid(), null);

        // Assert
        link.LinkType.Should().Be(linkType);
    }

    #endregion

    #region Helpers

    private static Sponsor CreateTestSponsor() =>
        Sponsor.Create(
            "Test Corp",
            "Test Person",
            "test@example.com",
            "+41 79 000 00 00",
            "https://test.com",
            "Teststrasse 1",
            "Bern",
            "3000",
            "Schweiz",
            SponsorTier.Silver,
            "Test notes",
            null,
            null);

    #endregion
}
