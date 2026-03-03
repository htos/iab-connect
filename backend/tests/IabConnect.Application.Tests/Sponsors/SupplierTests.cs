using FluentAssertions;
using IabConnect.Domain.Sponsors;
using Xunit;

namespace IabConnect.Application.Tests.Sponsors;

/// <summary>
/// Unit tests for Supplier aggregate root
/// REQ-032: Lieferantenverwaltung
/// </summary>
public class SupplierTests
{
    #region Create Tests

    [Fact]
    public void Create_NewSupplier_ShouldSetAllProperties()
    {
        // Arrange & Act
        var supplier = Supplier.Create(
            "Catering AG",
            "Anna Meier",
            "anna@catering.ch",
            "+41 79 333 33 33",
            "https://catering.ch",
            "Kochstrasse 5",
            "Zürich",
            "8001",
            "Schweiz",
            "Catering",
            "Reliable caterer");

        // Assert
        supplier.CompanyName.Should().Be("Catering AG");
        supplier.ContactPerson.Should().Be("Anna Meier");
        supplier.Email.Should().Be("anna@catering.ch");
        supplier.Phone.Should().Be("+41 79 333 33 33");
        supplier.Website.Should().Be("https://catering.ch");
        supplier.Street.Should().Be("Kochstrasse 5");
        supplier.City.Should().Be("Zürich");
        supplier.PostalCode.Should().Be("8001");
        supplier.Country.Should().Be("Schweiz");
        supplier.Category.Should().Be("Catering");
        supplier.Notes.Should().Be("Reliable caterer");
    }

    [Fact]
    public void Create_NewSupplier_ShouldSetStatusToProspect()
    {
        // Arrange & Act
        var supplier = CreateTestSupplier();

        // Assert
        supplier.Status.Should().Be(SupplierStatus.Prospect);
    }

    [Fact]
    public void Create_NewSupplier_ShouldGenerateNewId()
    {
        // Arrange & Act
        var supplier = CreateTestSupplier();

        // Assert
        supplier.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_NewSupplier_ShouldRaiseSupplierCreatedEvent()
    {
        // Arrange & Act
        var supplier = CreateTestSupplier();

        // Assert
        supplier.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<SupplierCreatedEvent>();
    }

    [Fact]
    public void Create_WithNullOptionalFields_ShouldBeValid()
    {
        // Arrange & Act
        var supplier = Supplier.Create("Minimal Corp", null, null, null, null, null, null, null, null, null, null);

        // Assert
        supplier.CompanyName.Should().Be("Minimal Corp");
        supplier.ContactPerson.Should().BeNull();
        supplier.Email.Should().BeNull();
        supplier.Category.Should().BeNull();
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ExistingSupplier_ShouldUpdateAllProperties()
    {
        // Arrange
        var supplier = CreateTestSupplier();

        // Act
        supplier.Update(
            "Updated Catering",
            "Peter Müller",
            "peter@updated.ch",
            "+41 79 444 44 44",
            "https://updated.ch",
            "Neue Strasse 10",
            "Basel",
            "4000",
            "Schweiz",
            "Dekoration",
            "Updated notes");

        // Assert
        supplier.CompanyName.Should().Be("Updated Catering");
        supplier.ContactPerson.Should().Be("Peter Müller");
        supplier.Email.Should().Be("peter@updated.ch");
        supplier.Category.Should().Be("Dekoration");
    }

    #endregion

    #region Status Transition Tests

    [Fact]
    public void Activate_Supplier_ShouldSetStatusToActive()
    {
        // Arrange
        var supplier = CreateTestSupplier();

        // Act
        supplier.Activate();

        // Assert
        supplier.Status.Should().Be(SupplierStatus.Active);
    }

    [Fact]
    public void Activate_Supplier_ShouldRaiseStatusChangedEvent()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        supplier.ClearDomainEvents();

        // Act
        supplier.Activate();

        // Assert
        supplier.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<SupplierStatusChangedEvent>();
    }

    [Fact]
    public void Pause_Supplier_ShouldSetStatusToPaused()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        supplier.Activate();

        // Act
        supplier.Pause();

        // Assert
        supplier.Status.Should().Be(SupplierStatus.Paused);
    }

    [Fact]
    public void End_Supplier_ShouldSetStatusToEnded()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        supplier.Activate();

        // Act
        supplier.End();

        // Assert
        supplier.Status.Should().Be(SupplierStatus.Ended);
    }

    #endregion

    #region ContractLink Management Tests

    [Fact]
    public void AddContractLink_ShouldAddToLinksList()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        var targetId = Guid.NewGuid();

        // Act
        var link = supplier.AddContractLink(ContractLinkType.Document, targetId, "Service contract");

        // Assert
        supplier.ContractLinks.Should().HaveCount(1);
        link.LinkType.Should().Be(ContractLinkType.Document);
        link.TargetId.Should().Be(targetId);
        link.Description.Should().Be("Service contract");
    }

    [Fact]
    public void RemoveContractLink_ExistingLink_ShouldRemoveFromList()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        var link = supplier.AddContractLink(ContractLinkType.Invoice, Guid.NewGuid(), null);

        // Act
        supplier.RemoveContractLink(link.Id);

        // Assert
        supplier.ContractLinks.Should().BeEmpty();
    }

    [Fact]
    public void RemoveContractLink_NonExistingId_ShouldDoNothing()
    {
        // Arrange
        var supplier = CreateTestSupplier();
        supplier.AddContractLink(ContractLinkType.Event, Guid.NewGuid(), null);

        // Act
        supplier.RemoveContractLink(Guid.NewGuid());

        // Assert
        supplier.ContractLinks.Should().HaveCount(1);
    }

    #endregion

    #region Helpers

    private static Supplier CreateTestSupplier() =>
        Supplier.Create(
            "Test Catering AG",
            "Test Person",
            "test@supplier.ch",
            "+41 79 000 00 00",
            "https://supplier.ch",
            "Teststrasse 1",
            "Bern",
            "3000",
            "Schweiz",
            "Catering",
            "Test notes");

    #endregion
}
