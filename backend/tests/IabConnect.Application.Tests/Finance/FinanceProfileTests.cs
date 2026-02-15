using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for FinanceProfile entity (REQ-060, REQ-062)
/// </summary>
public class FinanceProfileTests
{
    private static FinanceProfile CreateChProfile() =>
        FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Indischer Kulturverein", "Bundesplatz 1", "Bern", "3011", "CH",
            "info@verein.ch", "+41 31 123 45 67", "https://verein.ch", "CHE-123.456.789",
            "PostFinance", "CH93 0076 2011 6238 5295 7", "POFICHBEXXX");

    private static FinanceProfile CreateEuProfile() =>
        FinanceProfile.Create(
            Jurisdiction.EU, "DE", FinanceCurrency.EUR, 1,
            "Verein e.V.", "Hauptstrasse 1", "Berlin", "10115", "DE",
            "info@verein.de", null, null, null,
            "Deutsche Bank", "DE89 3704 0044 0532 0130 00", "COBADEFFXXX",
            VatStatus.Registered, "DE123456789");

    #region Create Tests

    [Fact]
    public void Create_ChProfile_ShouldSetAllProperties()
    {
        // Act
        var profile = CreateChProfile();

        // Assert
        profile.Jurisdiction.Should().Be(Jurisdiction.CH);
        profile.CountryCode.Should().BeNull();
        profile.Currency.Should().Be(FinanceCurrency.CHF);
        profile.FiscalYearStartMonth.Should().Be(1);
        profile.OrganizationName.Should().Be("Indischer Kulturverein");
        profile.OrganizationCity.Should().Be("Bern");
        profile.OrganizationCountry.Should().Be("CH");
        profile.BankName.Should().Be("PostFinance");
        profile.IsActive.Should().BeTrue();
        profile.VatStatus.Should().Be(VatStatus.NotRegistered);
    }

    [Fact]
    public void Create_EuProfile_ShouldSetCountryCodeAndVat()
    {
        // Act
        var profile = CreateEuProfile();

        // Assert
        profile.Jurisdiction.Should().Be(Jurisdiction.EU);
        profile.CountryCode.Should().Be("DE");
        profile.Currency.Should().Be(FinanceCurrency.EUR);
        profile.VatStatus.Should().Be(VatStatus.Registered);
        profile.VatNumber.Should().Be("DE123456789");
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var profile = CreateChProfile();

        // Assert
        profile.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetTimestamps()
    {
        // Arrange
        var before = DateTimeOffset.UtcNow.AddSeconds(-1);

        // Act
        var profile = CreateChProfile();

        // Assert
        profile.CreatedAt.Should().BeAfter(before);
        profile.UpdatedAt.Should().BeAfter(before);
    }

    [Fact]
    public void Create_ShouldTrimStrings()
    {
        // Act
        var profile = FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "  Name  ", "  Address  ", "  City  ", "  1234  ", "  ch  ",
            "  email@test.ch  ", null, null, null,
            null, null, null);

        // Assert
        profile.OrganizationName.Should().Be("Name");
        profile.OrganizationAddress.Should().Be("Address");
        profile.OrganizationCity.Should().Be("City");
        profile.OrganizationPostalCode.Should().Be("1234");
        profile.OrganizationCountry.Should().Be("CH"); // uppercased + trimmed
        profile.OrganizationEmail.Should().Be("email@test.ch");
    }

    [Fact]
    public void Create_WithEmptyOrgName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "", "Address", "City", "3000", "CH",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("organizationName");
    }

    [Fact]
    public void Create_WithEmptyOrgAddress_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Name", "", "City", "3000", "CH",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("organizationAddress");
    }

    [Fact]
    public void Create_WithEmptyOrgCity_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Name", "Address", "", "3000", "CH",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("organizationCity");
    }

    [Fact]
    public void Create_WithEmptyOrgPostalCode_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Name", "Address", "City", "", "CH",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("organizationPostalCode");
    }

    [Fact]
    public void Create_WithEmptyOrgCountry_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Name", "Address", "City", "3000", "",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("organizationCountry");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(13)]
    [InlineData(-1)]
    public void Create_WithInvalidFiscalYearStartMonth_ShouldThrow(int month)
    {
        // Act & Assert
        var act = () => FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, month,
            "Name", "Address", "City", "3000", "CH",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("fiscalYearStartMonth");
    }

    [Theory]
    [InlineData(VatStatus.NotRegistered)]
    [InlineData(VatStatus.Registered)]
    [InlineData(VatStatus.SmallBusiness)]
    public void Create_WithDifferentVatStatus_ShouldSetCorrectly(VatStatus vatStatus)
    {
        // Act
        var profile = FinanceProfile.Create(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "Name", "Address", "City", "3000", "CH",
            null, null, null, null, null, null, null,
            vatStatus);

        // Assert
        profile.VatStatus.Should().Be(vatStatus);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldUpdateAllProperties()
    {
        // Arrange
        var profile = CreateChProfile();

        // Act
        profile.Update(
            Jurisdiction.EU, "AT", FinanceCurrency.EUR, 4,
            "Neuer Verein", "Neue Strasse", "Wien", "1010", "AT",
            "neu@verein.at", null, null, null,
            "Erste Bank", "AT12 3456 7890 1234 5678", null,
            VatStatus.SmallBusiness, "ATU12345678");

        // Assert
        profile.Jurisdiction.Should().Be(Jurisdiction.EU);
        profile.CountryCode.Should().Be("AT");
        profile.Currency.Should().Be(FinanceCurrency.EUR);
        profile.FiscalYearStartMonth.Should().Be(4);
        profile.OrganizationName.Should().Be("Neuer Verein");
        profile.OrganizationCountry.Should().Be("AT");
        profile.VatStatus.Should().Be(VatStatus.SmallBusiness);
        profile.VatNumber.Should().Be("ATU12345678");
        profile.UpdatedAt.Should().BeAfter(profile.CreatedAt);
    }

    [Fact]
    public void Update_WithEmptyOrgName_ShouldThrowArgumentException()
    {
        // Arrange
        var profile = CreateChProfile();

        // Act & Assert
        var act = () => profile.Update(
            Jurisdiction.CH, null, FinanceCurrency.CHF, 1,
            "", "Address", "City", "3000", "CH",
            null, null, null, null, null, null, null);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("organizationName");
    }

    #endregion

    #region Deactivate Tests

    [Fact]
    public void Deactivate_ShouldSetIsActiveFalse()
    {
        // Arrange
        var profile = CreateChProfile();

        // Act
        profile.Deactivate();

        // Assert
        profile.IsActive.Should().BeFalse();
        profile.UpdatedAt.Should().BeAfter(profile.CreatedAt);
    }

    #endregion
}
