using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for TaxCode entity (REQ-062)
/// </summary>
public class TaxCodeTests
{
    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var taxCode = TaxCode.Create("MWST77", "MWST 7.7%", 0.077m, isDefault: true);

        // Assert
        taxCode.Code.Should().Be("MWST77");
        taxCode.Label.Should().Be("MWST 7.7%");
        taxCode.Rate.Should().Be(0.077m);
        taxCode.IsDefault.Should().BeTrue();
        taxCode.IsActive.Should().BeTrue();
        taxCode.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var taxCode = TaxCode.Create("VAT", "VAT Standard", 0.077m);

        // Assert
        taxCode.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldUpperCaseCode()
    {
        // Act
        var taxCode = TaxCode.Create("mwst77", "Label", 0.077m);

        // Assert
        taxCode.Code.Should().Be("MWST77");
    }

    [Fact]
    public void Create_ShouldTrimCodeAndLabel()
    {
        // Act
        var taxCode = TaxCode.Create("  code  ", "  label  ", 0.05m);

        // Assert
        taxCode.Code.Should().Be("CODE");
        taxCode.Label.Should().Be("label");
    }

    [Fact]
    public void Create_WithEmptyCode_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => TaxCode.Create("", "Label", 0.077m);
        act.Should().Throw<ArgumentException>()
            .WithParameterName("code");
    }

    [Fact]
    public void Create_WithEmptyLabel_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => TaxCode.Create("CODE", "", 0.077m);
        act.Should().Throw<ArgumentException>()
            .WithParameterName("label");
    }

    [Fact]
    public void Create_WithNegativeRate_ShouldThrowArgumentOutOfRangeException()
    {
        // Act & Assert
        var act = () => TaxCode.Create("CODE", "Label", -0.01m);
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("rate");
    }

    [Fact]
    public void Create_WithRateGreaterThanOne_ShouldThrowArgumentOutOfRangeException()
    {
        // Act & Assert
        var act = () => TaxCode.Create("CODE", "Label", 1.01m);
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("rate");
    }

    [Fact]
    public void Create_WithZeroRate_ShouldSucceed()
    {
        // Act
        var taxCode = TaxCode.Create("EXEMPT", "Exempt", 0m);

        // Assert
        taxCode.Rate.Should().Be(0m);
    }

    [Fact]
    public void Create_WithRateOfOne_ShouldSucceed()
    {
        // Act — edge case: 100% tax
        var taxCode = TaxCode.Create("FULL", "Full Tax", 1m);

        // Assert
        taxCode.Rate.Should().Be(1m);
    }

    [Fact]
    public void Create_DefaultFlag_ShouldDefaultToFalse()
    {
        // Act
        var taxCode = TaxCode.Create("CODE", "Label", 0.05m);

        // Assert
        taxCode.IsDefault.Should().BeFalse();
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldUpdateAllProperties()
    {
        // Arrange
        var taxCode = TaxCode.Create("OLD", "Old Label", 0.077m);

        // Act
        taxCode.Update("NEW", "New Label", 0.081m, true, false);

        // Assert
        taxCode.Code.Should().Be("NEW");
        taxCode.Label.Should().Be("New Label");
        taxCode.Rate.Should().Be(0.081m);
        taxCode.IsDefault.Should().BeTrue();
        taxCode.IsActive.Should().BeFalse();
        taxCode.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void Update_WithInvalidRate_ShouldThrowArgumentOutOfRangeException()
    {
        // Arrange
        var taxCode = TaxCode.Create("CODE", "Label", 0.077m);

        // Act & Assert
        var act = () => taxCode.Update("CODE", "Label", 1.5m, false, true);
        act.Should().Throw<ArgumentOutOfRangeException>()
            .WithParameterName("rate");
    }

    [Fact]
    public void Update_WithEmptyCode_ShouldThrowArgumentException()
    {
        // Arrange
        var taxCode = TaxCode.Create("CODE", "Label", 0.077m);

        // Act & Assert
        var act = () => taxCode.Update("", "Label", 0.077m, false, true);
        act.Should().Throw<ArgumentException>()
            .WithParameterName("code");
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedAndDeactivate()
    {
        // Arrange
        var taxCode = TaxCode.Create("CODE", "Label", 0.077m);

        // Act
        taxCode.SoftDelete();

        // Assert
        taxCode.IsDeleted.Should().BeTrue();
        taxCode.IsActive.Should().BeFalse();
        taxCode.DeletedAt.Should().NotBeNull();
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var taxCode = TaxCode.Create("CODE", "Label", 0.077m);
        taxCode.SoftDelete();

        // Act
        taxCode.Restore();

        // Assert
        taxCode.IsDeleted.Should().BeFalse();
        taxCode.DeletedAt.Should().BeNull();
    }

    #endregion
}
