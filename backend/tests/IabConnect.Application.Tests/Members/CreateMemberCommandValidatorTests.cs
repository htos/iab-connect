using FluentAssertions;
using IabConnect.Application.Members.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// Unit tests for CreateMemberCommandValidator
/// </summary>
public class CreateMemberCommandValidatorTests
{
    private readonly CreateMemberCommandValidator _validator = new();

    [Fact]
    public void Validate_ValidCommand_ShouldNotHaveErrors()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max.mustermann@example.com",
            Phone = "+41 79 123 45 67",
            Street = "Bundesplatz 1",
            City = "Bern",
            PostalCode = "3011",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptyFirstName_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "",
            LastName = "Mustermann",
            Email = "max@example.com",
            Street = "Strasse 1",
            City = "Bern",
            PostalCode = "3000",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "FirstName");
    }

    [Fact]
    public void Validate_InvalidEmail_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "invalid-email",
            Street = "Strasse 1",
            City = "Bern",
            PostalCode = "3000",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Email");
    }
}
