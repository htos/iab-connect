using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Payment entity (REQ-040)
/// </summary>
public class PaymentTests
{
    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Arrange
        var invoiceId = Guid.NewGuid();
        var transactionId = Guid.NewGuid();

        // Act
        var payment = Payment.Create(
            DateTime.UtcNow, 250m, PaymentMethod.Transfer,
            "REF-001", invoiceId, transactionId, "Payment note", "admin");

        // Assert
        payment.Amount.Should().Be(250m);
        payment.Method.Should().Be(PaymentMethod.Transfer);
        payment.Reference.Should().Be("REF-001");
        payment.InvoiceId.Should().Be(invoiceId);
        payment.TransactionId.Should().Be(transactionId);
        payment.Notes.Should().Be("Payment note");
        payment.CreatedBy.Should().Be("admin");
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentMethod.Cash, null, null, null, null, "admin");

        // Assert
        payment.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_WithZeroAmount_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Payment.Create(
            DateTime.UtcNow, 0m, PaymentMethod.Cash, null, null, null, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("amount");
    }

    [Fact]
    public void Create_WithNegativeAmount_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Payment.Create(
            DateTime.UtcNow, -50m, PaymentMethod.Cash, null, null, null, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("amount");
    }

    [Fact]
    public void Create_WithNullInvoiceId_ShouldAllowNull()
    {
        // Act
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentMethod.Cash, null, null, null, null, "admin");

        // Assert
        payment.InvoiceId.Should().BeNull();
        payment.TransactionId.Should().BeNull();
    }

    [Theory]
    [InlineData(PaymentMethod.Cash)]
    [InlineData(PaymentMethod.Transfer)]
    [InlineData(PaymentMethod.Online)]
    public void Create_WithDifferentMethods_ShouldSetCorrectMethod(PaymentMethod method)
    {
        // Act
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, method, null, null, null, null, "admin");

        // Assert
        payment.Method.Should().Be(method);
    }

    [Fact]
    public void Create_ShouldTrimStrings()
    {
        // Act
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentMethod.Cash,
            "  REF  ", null, null, "  Notes  ", "admin");

        // Assert
        payment.Reference.Should().Be("REF");
        payment.Notes.Should().Be("Notes");
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldUpdateAllProperties()
    {
        // Arrange
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentMethod.Cash, null, null, null, null, "admin");
        var invoiceId = Guid.NewGuid();
        var transactionId = Guid.NewGuid();

        // Act
        payment.Update(
            DateTime.UtcNow, 200m, PaymentMethod.Transfer,
            "NEW-REF", invoiceId, transactionId, "Updated", "editor");

        // Assert
        payment.Amount.Should().Be(200m);
        payment.Method.Should().Be(PaymentMethod.Transfer);
        payment.Reference.Should().Be("NEW-REF");
        payment.InvoiceId.Should().Be(invoiceId);
        payment.TransactionId.Should().Be(transactionId);
        payment.Notes.Should().Be("Updated");
        payment.UpdatedBy.Should().Be("editor");
        payment.UpdatedAt.Should().NotBeNull();
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentMethod.Cash, null, null, null, null, "admin");

        // Act
        payment.SoftDelete("admin");

        // Assert
        payment.IsDeleted.Should().BeTrue();
        payment.DeletedAt.Should().NotBeNull();
        payment.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var payment = Payment.Create(
            DateTime.UtcNow, 100m, PaymentMethod.Cash, null, null, null, null, "admin");
        payment.SoftDelete("admin");

        // Act
        payment.Restore();

        // Assert
        payment.IsDeleted.Should().BeFalse();
        payment.DeletedAt.Should().BeNull();
        payment.DeletedBy.Should().BeNull();
    }

    #endregion
}
