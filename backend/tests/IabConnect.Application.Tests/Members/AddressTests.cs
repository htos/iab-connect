using FluentAssertions;
using IabConnect.Domain.Members;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// Unit tests for Address value object
/// </summary>
public class AddressTests
{
    #region Create Tests

    [Fact]
    public void Create_ValidAddress_ShouldSetAllProperties()
    {
        // Act
        var address = Address.Create("Bundesplatz 1", "Bern", "3011", "Schweiz");

        // Assert
        address.Street.Should().Be("Bundesplatz 1");
        address.City.Should().Be("Bern");
        address.PostalCode.Should().Be("3011");
        address.Country.Should().Be("Schweiz");
    }

    [Fact]
    public void Create_WithWhitespace_ShouldTrimValues()
    {
        // Act
        var address = Address.Create("  Strasse 1  ", "  Zürich  ", "  8000  ", "  Schweiz  ");

        // Assert
        address.Street.Should().Be("Strasse 1");
        address.City.Should().Be("Zürich");
        address.PostalCode.Should().Be("8000");
        address.Country.Should().Be("Schweiz");
    }

    [Fact]
    public void Create_EmptyStreet_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Address.Create("", "Bern", "3000", "Schweiz");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("street");
    }

    [Fact]
    public void Create_NullStreet_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Address.Create(null!, "Bern", "3000", "Schweiz");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("street");
    }

    [Fact]
    public void Create_WhitespaceOnlyStreet_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Address.Create("   ", "Bern", "3000", "Schweiz");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("street");
    }

    [Fact]
    public void Create_EmptyCity_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Address.Create("Strasse 1", "", "3000", "Schweiz");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("city");
    }

    [Fact]
    public void Create_EmptyPostalCode_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Address.Create("Strasse 1", "Bern", "", "Schweiz");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("postalCode");
    }

    [Fact]
    public void Create_EmptyCountry_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Address.Create("Strasse 1", "Bern", "3000", "");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("country");
    }

    #endregion

    #region CreateEmpty Tests

    [Fact]
    public void CreateEmpty_ShouldReturnPlaceholderAddress()
    {
        // Act
        var address = Address.CreateEmpty();

        // Assert
        address.Street.Should().Be("Nicht angegeben");
        address.City.Should().Be("Nicht angegeben");
        address.PostalCode.Should().Be("0000");
        address.Country.Should().Be("Schweiz");
    }

    #endregion

    #region Equality Tests

    [Fact]
    public void Equals_SameValues_ShouldBeEqual()
    {
        // Arrange
        var address1 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var address2 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");

        // Act & Assert
        address1.Should().Be(address2);
        (address1 == address2).Should().BeTrue();
    }

    [Fact]
    public void Equals_DifferentStreet_ShouldNotBeEqual()
    {
        // Arrange
        var address1 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var address2 = Address.Create("Strasse 2", "Bern", "3000", "Schweiz");

        // Act & Assert
        address1.Should().NotBe(address2);
        (address1 != address2).Should().BeTrue();
    }

    [Fact]
    public void Equals_DifferentCity_ShouldNotBeEqual()
    {
        // Arrange
        var address1 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var address2 = Address.Create("Strasse 1", "Zürich", "3000", "Schweiz");

        // Act & Assert
        address1.Should().NotBe(address2);
    }

    [Fact]
    public void Equals_DifferentPostalCode_ShouldNotBeEqual()
    {
        // Arrange
        var address1 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var address2 = Address.Create("Strasse 1", "Bern", "8000", "Schweiz");

        // Act & Assert
        address1.Should().NotBe(address2);
    }

    [Fact]
    public void Equals_DifferentCountry_ShouldNotBeEqual()
    {
        // Arrange
        var address1 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var address2 = Address.Create("Strasse 1", "Bern", "3000", "Deutschland");

        // Act & Assert
        address1.Should().NotBe(address2);
    }

    [Fact]
    public void GetHashCode_SameValues_ShouldBeSame()
    {
        // Arrange
        var address1 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");
        var address2 = Address.Create("Strasse 1", "Bern", "3000", "Schweiz");

        // Act & Assert
        address1.GetHashCode().Should().Be(address2.GetHashCode());
    }

    #endregion

    #region ToString Tests

    [Fact]
    public void ToString_ShouldReturnFormattedAddress()
    {
        // Arrange
        var address = Address.Create("Bundesplatz 1", "Bern", "3011", "Schweiz");

        // Act
        var result = address.ToString();

        // Assert
        result.Should().Be("Bundesplatz 1, 3011 Bern, Schweiz");
    }

    #endregion
}
