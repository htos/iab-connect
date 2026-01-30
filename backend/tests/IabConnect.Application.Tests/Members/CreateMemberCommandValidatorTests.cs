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

    [Fact]
    public void Validate_EmptyLastName_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "",
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
        result.Errors.Should().Contain(e => e.PropertyName == "LastName");
    }

    [Fact]
    public void Validate_EmptyStreet_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Street = "",
            City = "Bern",
            PostalCode = "3000",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Street");
    }

    [Fact]
    public void Validate_EmptyCity_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Street = "Strasse 1",
            City = "",
            PostalCode = "3000",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "City");
    }

    [Fact]
    public void Validate_EmptyPostalCode_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Street = "Strasse 1",
            City = "Bern",
            PostalCode = "",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "PostalCode");
    }

    [Fact]
    public void Validate_EmptyCountry_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Street = "Strasse 1",
            City = "Bern",
            PostalCode = "3000",
            Country = "",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Country");
    }

    [Fact]
    public void Validate_FirstNameTooLong_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = new string('A', 101),
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
    public void Validate_EmailTooLong_ShouldHaveError()
    {
        // Arrange - Email max is 255, so 256+ should fail
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = new string('a', 252) + "@b.ch", // 252 + 5 = 257 > 255
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

    [Fact]
    public void Validate_PhoneTooLong_ShouldHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Phone = new string('1', 31),
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
        result.Errors.Should().Contain(e => e.PropertyName == "Phone");
    }

    [Fact]
    public void Validate_ValidPhoneWithinLimit_ShouldNotHaveError()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Phone = "+41 79 123 45 67",
            Street = "Strasse 1",
            City = "Bern",
            PostalCode = "3000",
            Country = "Schweiz",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData(MembershipType.Regular)]
    [InlineData(MembershipType.Student)]
    [InlineData(MembershipType.Family)]
    [InlineData(MembershipType.Honorary)]
    public void Validate_ValidMembershipTypes_ShouldNotHaveError(MembershipType type)
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "Max",
            LastName = "Mustermann",
            Email = "max@example.com",
            Street = "Strasse 1",
            City = "Bern",
            PostalCode = "3000",
            Country = "Schweiz",
            MembershipType = type
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_MultipleErrors_ShouldReportAll()
    {
        // Arrange
        var command = new CreateMemberCommand
        {
            FirstName = "",
            LastName = "",
            Email = "invalid",
            Street = "",
            City = "",
            PostalCode = "",
            Country = "",
            MembershipType = MembershipType.Regular
        };

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Count.Should().BeGreaterThanOrEqualTo(7);
    }
}
