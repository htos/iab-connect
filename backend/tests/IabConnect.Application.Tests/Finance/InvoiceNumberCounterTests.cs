using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// REQ-071: Tests for InvoiceNumberCounter entity and Invoice number immutability.
/// </summary>
public class InvoiceNumberCounterTests
{
    #region InvoiceNumberCounter Entity Tests

    [Fact]
    public void Create_WithValidData_ShouldInitializeCorrectly()
    {
        // Arrange
        var profileId = Guid.NewGuid();

        // Act
        var counter = InvoiceNumberCounter.Create(profileId, 2026, "INV-2026-");

        // Assert
        counter.FinanceProfileId.Should().Be(profileId);
        counter.FiscalYear.Should().Be(2026);
        counter.Prefix.Should().Be("INV-2026-");
        counter.CurrentValue.Should().Be(0);
        counter.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_WithEmptyPrefix_ShouldThrow()
    {
        // Act & Assert
        var act = () => InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "");

        act.Should().Throw<ArgumentException>()
            .WithMessage("*Prefix*");
    }

    [Fact]
    public void GetNextNumber_FirstCall_ShouldReturn0001()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");

        // Act
        var number = counter.GetNextNumber();

        // Assert
        number.Should().Be("INV-2026-0001");
        counter.CurrentValue.Should().Be(1);
    }

    [Fact]
    public void GetNextNumber_MultipleCalls_ShouldIncrementSequentially()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");

        // Act
        var n1 = counter.GetNextNumber();
        var n2 = counter.GetNextNumber();
        var n3 = counter.GetNextNumber();

        // Assert
        n1.Should().Be("INV-2026-0001");
        n2.Should().Be("INV-2026-0002");
        n3.Should().Be("INV-2026-0003");
        counter.CurrentValue.Should().Be(3);
    }

    [Fact]
    public void GetNextNumber_ShouldUpdateTimestamp()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");
        var before = counter.UpdatedAt;

        // Act
        counter.GetNextNumber();

        // Assert
        counter.UpdatedAt.Should().BeOnOrAfter(before);
    }

    [Fact]
    public void SeedValue_ShouldSetCurrentValue()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");

        // Act
        counter.SeedValue(42);

        // Assert
        counter.CurrentValue.Should().Be(42);
    }

    [Fact]
    public void SeedValue_ThenGetNext_ShouldContinueFromSeededValue()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");
        counter.SeedValue(99);

        // Act
        var number = counter.GetNextNumber();

        // Assert
        number.Should().Be("INV-2026-0100");
        counter.CurrentValue.Should().Be(100);
    }

    [Fact]
    public void SeedValue_WithNegative_ShouldThrow()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");

        // Act & Assert
        var act = () => counter.SeedValue(-1);

        act.Should().Throw<ArgumentOutOfRangeException>();
    }

    [Fact]
    public void GetNextNumber_PadsFourDigits()
    {
        // Arrange
        var counter = InvoiceNumberCounter.Create(Guid.NewGuid(), 2026, "INV-2026-");

        // Act
        var number = counter.GetNextNumber();

        // Assert — "INV-2026-0001" has zero-padded 4-digit sequence
        number.Should().MatchRegex(@"^INV-2026-\d{4}$");
    }

    #endregion

    #region Invoice Immutability Tests (REQ-071)

    private static Invoice CreateDraftInvoice(string number = "INV-2026-0001") =>
        Invoice.Create(
            number,
            DateTime.UtcNow,
            DateTime.UtcNow.AddDays(30),
            RecipientType.Member,
            Guid.NewGuid(),
            "Max Mustermann",
            "Teststrasse 1, 3000 Bern",
            7.7m,
            "Test invoice",
            "admin");

    [Fact]
    public void DraftInvoice_IsInvoiceNumberImmutable_ShouldBeFalse()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Assert
        invoice.IsInvoiceNumberImmutable.Should().BeFalse();
    }

    [Fact]
    public void SentInvoice_IsInvoiceNumberImmutable_ShouldBeTrue()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");

        // Assert
        invoice.IsInvoiceNumberImmutable.Should().BeTrue();
    }

    [Fact]
    public void PaidInvoice_IsInvoiceNumberImmutable_ShouldBeTrue()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");
        invoice.MarkAsPaid("admin");

        // Assert
        invoice.IsInvoiceNumberImmutable.Should().BeTrue();
    }

    [Fact]
    public void CancelledInvoice_IsInvoiceNumberImmutable_ShouldBeTrue()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");
        invoice.Cancel("Storno", "admin");

        // Assert
        invoice.IsInvoiceNumberImmutable.Should().BeTrue();
    }

    [Fact]
    public void SentInvoice_Update_ShouldThrowInvalidOperationException()
    {
        // Arrange — once sent, the entire invoice (including InvoiceNumber) is locked
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.Update(
            DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "New Name", null,
            7.7m, null, "admin");

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public void SentInvoice_AddItem_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.AddItem("New Item", 1, 100);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public void SentInvoice_RemoveItem_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.RemoveItem(Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    [Fact]
    public void SentInvoice_SetItems_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.SetItems([]);

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*draft*");
    }

    #endregion
}
