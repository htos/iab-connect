using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for InvoiceItem entity (REQ-039, REQ-062)
/// </summary>
public class InvoiceItemTests
{
    private static readonly Guid InvoiceId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetProperties()
    {
        // Act
        var item = InvoiceItem.Create(InvoiceId, "Mitgliedsbeitrag", 2, 50m);

        // Assert
        item.InvoiceId.Should().Be(InvoiceId);
        item.Description.Should().Be("Mitgliedsbeitrag");
        item.Quantity.Should().Be(2);
        item.UnitPrice.Should().Be(50m);
        item.Amount.Should().Be(100m); // 2 * 50
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var item = InvoiceItem.Create(InvoiceId, "Item", 1, 10m);

        // Assert
        item.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldTrimDescription()
    {
        // Act
        var item = InvoiceItem.Create(InvoiceId, "  Service  ", 1, 10m);

        // Assert
        item.Description.Should().Be("Service");
    }

    [Fact]
    public void Create_WithEmptyDescription_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => InvoiceItem.Create(InvoiceId, "", 1, 10m);
        act.Should().Throw<ArgumentException>()
            .WithParameterName("description");
    }

    [Fact]
    public void Create_ShouldRoundAmountToTwoDecimals()
    {
        // Act — 3 * 33.333 = 99.999, rounded to 2 decimals = 100.00
        var item = InvoiceItem.Create(InvoiceId, "Item", 3, 33.333m);

        // Assert
        item.Amount.Should().Be(Math.Round(3 * 33.333m, 2));
    }

    #endregion

    #region CreateWithTax — Net Entry Tests

    [Fact]
    public void CreateWithTax_NetEntry_ShouldCalculateGrossFromNet()
    {
        // Arrange
        var taxCodeId = Guid.NewGuid();

        // Act — net entry: 100 net + 7.7% = 107.70 gross
        var item = InvoiceItem.CreateWithTax(InvoiceId, "Service", 1, 100m, taxCodeId, 0.077m, isGrossEntry: false);

        // Assert
        item.NetAmount.Should().Be(100m);
        item.TaxRate.Should().Be(0.077m);
        item.TaxAmount.Should().Be(7.70m);
        item.GrossAmount.Should().Be(107.70m);
        item.IsGrossEntry.Should().BeFalse();
        item.TaxCodeId.Should().Be(taxCodeId);
    }

    [Fact]
    public void CreateWithTax_NetEntry_MultipleQuantity_ShouldCalculateCorrectly()
    {
        // Act — 2 * 50 net = 100 net
        var item = InvoiceItem.CreateWithTax(InvoiceId, "Service", 2, 50m, Guid.NewGuid(), 0.081m, isGrossEntry: false);

        // Assert
        item.NetAmount.Should().Be(100m);
        item.TaxAmount.Should().Be(8.10m); // 100 * 0.081
        item.GrossAmount.Should().Be(108.10m);
    }

    #endregion

    #region CreateWithTax — Gross Entry Tests

    [Fact]
    public void CreateWithTax_GrossEntry_ShouldDeriveNetFromGross()
    {
        // Act — gross entry: 107.70 gross
        var item = InvoiceItem.CreateWithTax(InvoiceId, "Service", 1, 107.70m, Guid.NewGuid(), 0.077m, isGrossEntry: true);

        // Assert
        item.GrossAmount.Should().Be(107.70m);
        item.NetAmount.Should().BeApproximately(100m, 0.01m);
        item.TaxAmount.Should().BeApproximately(7.70m, 0.01m);
        item.IsGrossEntry.Should().BeTrue();
    }

    #endregion

    #region Zero Tax Rate Tests

    [Fact]
    public void CreateWithTax_ZeroTaxRate_ShouldHaveZeroTax()
    {
        // Act — exempt: 0% tax
        var item = InvoiceItem.CreateWithTax(InvoiceId, "Exempt Item", 1, 100m, Guid.NewGuid(), 0m, isGrossEntry: false);

        // Assert
        item.TaxAmount.Should().Be(0m);
        item.NetAmount.Should().Be(100m);
        item.GrossAmount.Should().Be(100m);
    }

    [Fact]
    public void CreateWithTax_NullTaxRate_ShouldTreatAsZero()
    {
        // Act
        var item = InvoiceItem.CreateWithTax(InvoiceId, "No Tax", 1, 100m, null, null, isGrossEntry: false);

        // Assert
        item.TaxRate.Should().BeNull();
        item.TaxAmount.Should().Be(0m);
        item.NetAmount.Should().Be(100m);
        item.GrossAmount.Should().Be(100m);
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldRecalculateAmount()
    {
        // Arrange
        var item = InvoiceItem.Create(InvoiceId, "Old", 1, 100m);

        // Act
        item.Update("New", 3, 50m);

        // Assert
        item.Description.Should().Be("New");
        item.Quantity.Should().Be(3);
        item.UnitPrice.Should().Be(50m);
        item.Amount.Should().Be(150m);
    }

    [Fact]
    public void UpdateWithTax_ShouldRecalculateAmountsAndTax()
    {
        // Arrange
        var item = InvoiceItem.Create(InvoiceId, "Old", 1, 100m);
        var taxCodeId = Guid.NewGuid();

        // Act
        item.UpdateWithTax("Updated", 1, 200m, taxCodeId, 0.077m, isGrossEntry: false);

        // Assert
        item.Description.Should().Be("Updated");
        item.NetAmount.Should().Be(200m);
        item.TaxAmount.Should().Be(15.40m);
        item.GrossAmount.Should().Be(215.40m);
    }

    #endregion
}
