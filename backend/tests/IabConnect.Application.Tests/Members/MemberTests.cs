using FluentAssertions;
using IabConnect.Domain.Members;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// Unit tests for Member aggregate root
/// REQ-013, REQ-014, REQ-015, REQ-016
/// </summary>
public class MemberTests
{
    private static Address CreateTestAddress() =>
        Address.Create("Teststrasse 1", "Bern", "3000", "Schweiz");

    #region Create Tests

    [Fact]
    public void Create_NewMember_ShouldSetAllProperties()
    {
        // Arrange
        var address = CreateTestAddress();

        // Act
        var member = Member.Create(
            "Max",
            "Mustermann",
            "max@example.com",
            address,
            MembershipType.Regular,
            "+41 79 123 45 67");

        // Assert
        member.FirstName.Should().Be("Max");
        member.LastName.Should().Be("Mustermann");
        member.Email.Should().Be("max@example.com");
        member.Phone.Should().Be("+41 79 123 45 67");
        member.Address.Should().Be(address);
        member.MembershipType.Should().Be(MembershipType.Regular);
    }

    [Fact]
    public void Create_NewMember_ShouldSetStatusToPending()
    {
        // Arrange
        var address = CreateTestAddress();

        // Act
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Assert
        member.Status.Should().Be(MembershipStatus.Pending);
    }

    [Fact]
    public void Create_NewMember_ShouldSetMemberSinceToToday()
    {
        // Arrange
        var address = CreateTestAddress();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Act
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Assert
        member.MemberSince.Should().Be(today);
    }

    [Fact]
    public void Create_NewMember_ShouldGenerateNewId()
    {
        // Arrange
        var address = CreateTestAddress();

        // Act
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Assert
        member.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_NewMember_ShouldRaiseMemberCreatedEvent()
    {
        // Arrange
        var address = CreateTestAddress();

        // Act
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Assert
        member.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MemberCreatedEvent>();
    }

    [Theory]
    [InlineData(MembershipType.Regular)]
    [InlineData(MembershipType.Student)]
    [InlineData(MembershipType.Family)]
    [InlineData(MembershipType.Honorary)]
    public void Create_WithDifferentMembershipTypes_ShouldSetCorrectType(MembershipType type)
    {
        // Arrange
        var address = CreateTestAddress();

        // Act
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, type);

        // Assert
        member.MembershipType.Should().Be(type);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ExistingMember_ShouldUpdateAllProperties()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        var newAddress = Address.Create("Neue Strasse 2", "Zürich", "8000", "Schweiz");

        // Act
        member.Update("Anna", "Schmidt", "anna@example.com", newAddress, "+41 79 999 99 99");

        // Assert
        member.FirstName.Should().Be("Anna");
        member.LastName.Should().Be("Schmidt");
        member.Email.Should().Be("anna@example.com");
        member.Phone.Should().Be("+41 79 999 99 99");
        member.Address.Should().Be(newAddress);
    }

    [Fact]
    public void Update_WithNullPhone_ShouldClearPhone()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular, "+41 79 123 45 67");

        // Act
        member.Update("Max", "Mustermann", "max@example.com", address, null);

        // Assert
        member.Phone.Should().BeNull();
    }

    #endregion

    #region Status Transition Tests

    [Fact]
    public void Activate_PendingMember_ShouldSetStatusToActive()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Act
        member.Activate();

        // Assert
        member.Status.Should().Be(MembershipStatus.Active);
    }

    [Fact]
    public void Activate_PendingMember_ShouldRaiseMemberActivatedEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.ClearDomainEvents(); // Clear the MemberCreatedEvent

        // Act
        member.Activate();

        // Assert
        member.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MemberActivatedEvent>();
    }

    [Fact]
    public void Activate_AlreadyActiveMember_ShouldNotRaiseEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.Activate();
        member.ClearDomainEvents();

        // Act
        member.Activate(); // Second activation

        // Assert
        member.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void Deactivate_ActiveMember_ShouldSetStatusToInactive()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.Activate();

        // Act
        member.Deactivate();

        // Assert
        member.Status.Should().Be(MembershipStatus.Inactive);
    }

    [Fact]
    public void Deactivate_ActiveMember_ShouldRaiseMemberDeactivatedEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.Activate();
        member.ClearDomainEvents();

        // Act
        member.Deactivate();

        // Assert
        member.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MemberDeactivatedEvent>();
    }

    [Fact]
    public void Deactivate_AlreadyInactiveMember_ShouldNotRaiseEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.Activate();
        member.Deactivate();
        member.ClearDomainEvents();

        // Act
        member.Deactivate(); // Second deactivation

        // Assert
        member.DomainEvents.Should().BeEmpty();
    }

    [Fact]
    public void Suspend_ActiveMember_ShouldSetStatusToSuspended()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.Activate();

        // Act
        member.Suspend();

        // Assert
        member.Status.Should().Be(MembershipStatus.Suspended);
    }

    [Fact]
    public void Suspend_ActiveMember_ShouldRaiseMemberSuspendedEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.Activate();
        member.ClearDomainEvents();

        // Act
        member.Suspend();

        // Assert
        member.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MemberSuspendedEvent>();
    }

    #endregion

    #region Membership Type Change Tests

    [Fact]
    public void ChangeMembershipType_ToDifferentType_ShouldUpdateType()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Act
        member.ChangeMembershipType(MembershipType.Student);

        // Assert
        member.MembershipType.Should().Be(MembershipType.Student);
    }

    [Fact]
    public void ChangeMembershipType_ToDifferentType_ShouldRaiseMembershipTypeChangedEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.ClearDomainEvents();

        // Act
        member.ChangeMembershipType(MembershipType.Honorary);

        // Assert
        var @event = member.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MembershipTypeChangedEvent>().Subject;
        @event.OldType.Should().Be(MembershipType.Regular);
        @event.NewType.Should().Be(MembershipType.Honorary);
    }

    [Fact]
    public void ChangeMembershipType_ToSameType_ShouldNotRaiseEvent()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        member.ClearDomainEvents();

        // Act
        member.ChangeMembershipType(MembershipType.Regular);

        // Assert
        member.DomainEvents.Should().BeEmpty();
    }

    #endregion

    #region Keycloak Integration Tests

    [Fact]
    public void LinkToKeycloak_ShouldSetKeycloakUserId()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);
        var keycloakId = Guid.NewGuid();

        // Act
        member.LinkToKeycloak(keycloakId);

        // Assert
        member.KeycloakUserId.Should().Be(keycloakId);
    }

    #endregion

    #region FullName Property Tests

    [Fact]
    public void FullName_ShouldReturnCombinedName()
    {
        // Arrange
        var address = CreateTestAddress();
        var member = Member.Create("Max", "Mustermann", "max@example.com", address, MembershipType.Regular);

        // Act & Assert
        member.FullName.Should().Be("Max Mustermann");
    }

    #endregion
}
