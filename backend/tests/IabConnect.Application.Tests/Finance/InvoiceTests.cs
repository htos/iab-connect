using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Invoice entity (REQ-039, REQ-062) — most critical domain entity
/// </summary>
public class InvoiceTests
{
    private static Invoice CreateDraftInvoice(string? invoiceNumber = null) =>
        Invoice.Create(
            invoiceNumber ?? "INV-2026-001",
            DateTime.UtcNow,
            DateTime.UtcNow.AddDays(30),
            RecipientType.Member,
            Guid.NewGuid(),
            "Max Mustermann",
            "Teststrasse 1, 3000 Bern",
            7.7m,
            "Test invoice",
            "admin");

    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var invoice = CreateDraftInvoice();

        // Assert
        invoice.InvoiceNumber.Should().Be("INV-2026-001");
        invoice.RecipientName.Should().Be("Max Mustermann");
        invoice.RecipientType.Should().Be(RecipientType.Member);
        invoice.TaxRate.Should().Be(7.7m);
        invoice.Notes.Should().Be("Test invoice");
        invoice.CreatedBy.Should().Be("admin");
    }

    [Fact]
    public void Create_ShouldStartInDraftStatus()
    {
        // Act
        var invoice = CreateDraftInvoice();

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Draft);
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var invoice = CreateDraftInvoice();

        // Assert
        invoice.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldHaveEmptyItemsList()
    {
        // Act
        var invoice = CreateDraftInvoice();

        // Assert
        invoice.Items.Should().BeEmpty();
    }

    [Fact]
    public void Create_WithEmptyInvoiceNumber_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Invoice.Create(
            "", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "Name", null, 0m, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("invoiceNumber");
    }

    [Fact]
    public void Create_WithEmptyRecipientName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Invoice.Create(
            "INV-001", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "", null, 0m, null, "admin");

        act.Should().Throw<ArgumentException>()
            .WithParameterName("recipientName");
    }

    [Fact]
    public void Create_ShouldTrimStrings()
    {
        // Act
        var invoice = Invoice.Create(
            "  INV-001  ", DateTime.UtcNow, DateTime.UtcNow.AddDays(30),
            RecipientType.Member, null, "  Name  ", "  Address  ", 0m, "  Notes  ", "admin");

        // Assert
        invoice.InvoiceNumber.Should().Be("INV-001");
        invoice.RecipientName.Should().Be("Name");
        invoice.RecipientAddress.Should().Be("Address");
        invoice.Notes.Should().Be("Notes");
    }

    #endregion

    #region Add / Remove Item Tests

    [Fact]
    public void AddItem_ToDraft_ShouldAddAndRecalculate()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act
        invoice.AddItem("Mitgliedsbeitrag", 1, 100m);

        // Assert
        invoice.Items.Should().HaveCount(1);
        invoice.SubTotal.Should().Be(100m);
    }

    [Fact]
    public void AddItem_MultipleItems_ShouldRecalculateTotals()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act
        invoice.AddItem("Item 1", 2, 50m);
        invoice.AddItem("Item 2", 1, 200m);

        // Assert
        invoice.Items.Should().HaveCount(2);
        invoice.SubTotal.Should().Be(300m); // 2*50 + 1*200
    }

    [Fact]
    public void AddItemWithTax_NetEntry_ShouldCalculateGross()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        var taxCodeId = Guid.NewGuid();

        // Act — net entry: unit price = net price
        invoice.AddItemWithTax("Service", 1, 100m, taxCodeId, 0.077m, isGrossEntry: false);

        // Assert
        var item = invoice.Items.Single();
        item.NetAmount.Should().Be(100m);
        item.TaxAmount.Should().Be(7.70m);
        item.GrossAmount.Should().Be(107.70m);
    }

    [Fact]
    public void AddItemWithTax_GrossEntry_ShouldDeriveNet()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        var taxCodeId = Guid.NewGuid();

        // Act — gross entry: unit price = gross price
        invoice.AddItemWithTax("Service", 1, 107.70m, taxCodeId, 0.077m, isGrossEntry: true);

        // Assert
        var item = invoice.Items.Single();
        item.GrossAmount.Should().Be(107.70m);
        item.NetAmount.Should().BeApproximately(100m, 0.01m);
        item.TaxAmount.Should().BeApproximately(7.70m, 0.01m);
    }

    [Fact]
    public void RemoveItem_ShouldRemoveAndRecalculate()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item 1", 1, 100m);
        invoice.AddItem("Item 2", 1, 200m);
        var itemToRemove = invoice.Items[0].Id;

        // Act
        invoice.RemoveItem(itemToRemove);

        // Assert
        invoice.Items.Should().HaveCount(1);
        invoice.SubTotal.Should().Be(200m);
    }

    [Fact]
    public void RemoveItem_NonExistentId_ShouldNotChange()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item 1", 1, 100m);

        // Act
        invoice.RemoveItem(Guid.NewGuid());

        // Assert
        invoice.Items.Should().HaveCount(1);
    }

    [Fact]
    public void AddItem_ToNonDraftInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.AddItem("New Item", 1, 50m);
        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region SetItems Tests

    [Fact]
    public void SetItems_OnDraft_ShouldReplaceAllItems()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Old Item", 1, 50m);
        var newItems = new List<InvoiceItem>
        {
            InvoiceItem.Create(invoice.Id, "New Item 1", 1, 100m),
            InvoiceItem.Create(invoice.Id, "New Item 2", 2, 50m)
        };

        // Act
        invoice.SetItems(newItems);

        // Assert
        invoice.Items.Should().HaveCount(2);
        invoice.SubTotal.Should().Be(200m); // 100 + 2*50
    }

    #endregion

    #region Status Transition Tests

    [Fact]
    public void MarkAsSent_DraftInvoice_ShouldSetStatusToSent()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);

        // Act
        invoice.MarkAsSent("admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Sent);
        invoice.UpdatedBy.Should().Be("admin");
        invoice.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void MarkAsSent_NonDraftInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act & Assert — sending a Sent invoice
        var act = () => invoice.MarkAsSent("admin");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkAsPaid_SentInvoice_ShouldSetStatusToPaid()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act
        invoice.MarkAsPaid("admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public void MarkAsPaid_OverdueInvoice_ShouldSetStatusToPaid()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");
        invoice.MarkAsOverdue("admin");

        // Act
        invoice.MarkAsPaid("admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Paid);
    }

    [Fact]
    public void MarkAsPaid_CancelledInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");
        invoice.Cancel("Test reason", "admin");

        // Act & Assert
        var act = () => invoice.MarkAsPaid("admin");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkAsPaid_AlreadyPaidInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");
        invoice.MarkAsPaid("admin");

        // Act & Assert
        var act = () => invoice.MarkAsPaid("admin");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void MarkAsOverdue_SentInvoice_ShouldSetStatusToOverdue()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act
        invoice.MarkAsOverdue("admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Overdue);
    }

    [Fact]
    public void MarkAsOverdue_NonSentInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act & Assert
        var act = () => invoice.MarkAsOverdue("admin");
        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region Cancel Tests

    [Fact]
    public void Cancel_SentInvoice_ShouldSetStatusToCancelled()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act
        invoice.Cancel("Customer withdrew order", "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Cancelled);
        invoice.CancellationReason.Should().Be("Customer withdrew order");
        invoice.CancelledAt.Should().NotBeNull();
    }

    [Fact]
    public void Cancel_OverdueInvoice_ShouldSetStatusToCancelled()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");
        invoice.MarkAsOverdue("admin");

        // Act
        invoice.Cancel("Uncollectable", "admin");

        // Assert
        invoice.Status.Should().Be(InvoiceStatus.Cancelled);
    }

    [Fact]
    public void Cancel_DraftInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act & Assert
        var act = () => invoice.Cancel("Reason", "admin");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Cancel_PaidInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");
        invoice.MarkAsPaid("admin");

        // Act & Assert
        var act = () => invoice.Cancel("Reason", "admin");
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Cancel_WithEmptyReason_ShouldThrowArgumentException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.Cancel("", "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("reason");
    }

    [Fact]
    public void Cancel_ShouldTrimReason()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act
        invoice.Cancel("  Reason  ", "admin");

        // Assert
        invoice.CancellationReason.Should().Be("Reason");
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_DraftInvoice_ShouldUpdateProperties()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act
        invoice.Update(
            DateTime.UtcNow, DateTime.UtcNow.AddDays(60),
            RecipientType.Sponsor, null, "Sponsor AG", "Neue Strasse", 8.1m, "Updated", "editor");

        // Assert
        invoice.RecipientType.Should().Be(RecipientType.Sponsor);
        invoice.RecipientName.Should().Be("Sponsor AG");
        invoice.TaxRate.Should().Be(8.1m);
        invoice.UpdatedBy.Should().Be("editor");
    }

    [Fact]
    public void Update_NonDraftInvoice_ShouldThrowInvalidOperationException()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.AddItem("Item", 1, 100m);
        invoice.MarkAsSent("admin");

        // Act & Assert
        var act = () => invoice.Update(
            DateTime.UtcNow, DateTime.UtcNow.AddDays(60),
            RecipientType.Sponsor, null, "Name", null, 0m, null, "editor");

        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region RecalculateTotals Tests

    [Fact]
    public void RecalculateTotals_WithTaxCodeItems_ShouldSumPerItemTax()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        var taxCodeId = Guid.NewGuid();

        // Act — add two items with tax (net entry)
        invoice.AddItemWithTax("Service A", 1, 100m, taxCodeId, 0.077m, isGrossEntry: false);
        invoice.AddItemWithTax("Service B", 2, 50m, taxCodeId, 0.077m, isGrossEntry: false);

        // Assert: SubtotalNet = 100 + 100 = 200, TotalTax = 7.70 + 7.70 = 15.40
        invoice.SubtotalNet.Should().Be(200m);
        invoice.TotalTax.Should().Be(15.40m);
        invoice.TotalGross.Should().Be(215.40m);
    }

    [Fact]
    public void RecalculateTotals_WithMixedTaxAndNoTax_ShouldHandleCorrectly()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act
        invoice.AddItem("No-tax item", 1, 100m); // legacy item, no tax
        invoice.AddItemWithTax("Tax item", 1, 100m, Guid.NewGuid(), 0.077m, false);

        // Assert
        invoice.Items.Should().HaveCount(2);
        invoice.SubTotal.Should().Be(200m); // sum of Amount fields
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var invoice = CreateDraftInvoice();

        // Act
        invoice.SoftDelete("admin");

        // Assert
        invoice.IsDeleted.Should().BeTrue();
        invoice.DeletedAt.Should().NotBeNull();
        invoice.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var invoice = CreateDraftInvoice();
        invoice.SoftDelete("admin");

        // Act
        invoice.Restore();

        // Assert
        invoice.IsDeleted.Should().BeFalse();
        invoice.DeletedAt.Should().BeNull();
        invoice.DeletedBy.Should().BeNull();
    }

    #endregion
}
