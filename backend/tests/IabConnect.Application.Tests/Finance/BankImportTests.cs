using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for BankImport and BankImportItem entities (REQ-041)
/// </summary>
public class BankImportTests
{
    #region BankImport Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetProperties()
    {
        // Act
        var import = BankImport.Create("export_2026_01.csv", "admin");

        // Assert
        import.FileName.Should().Be("export_2026_01.csv");
        import.ImportedBy.Should().Be("admin");
        import.Status.Should().Be(BankImportStatus.Pending);
        import.Items.Should().BeEmpty();
        import.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var import = BankImport.Create("file.csv", "admin");

        // Assert
        import.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetImportDateToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var import = BankImport.Create("file.csv", "admin");

        // Assert
        import.ImportDate.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    #endregion

    #region AddItem Tests

    [Fact]
    public void AddItem_ShouldAddToCollection()
    {
        // Arrange
        var import = BankImport.Create("file.csv", "admin");
        var item = BankImportItem.Create(
            import.Id, DateTime.UtcNow, "Payment from member", 100m, "CH93 0076", "REF-001");

        // Act
        import.AddItem(item);

        // Assert
        import.Items.Should().HaveCount(1);
        import.Items[0].Should().Be(item);
    }

    [Fact]
    public void AddItem_MultipleItems_ShouldAddAll()
    {
        // Arrange
        var import = BankImport.Create("file.csv", "admin");

        // Act
        import.AddItem(BankImportItem.Create(import.Id, DateTime.UtcNow, "Item 1", 100m, null, null));
        import.AddItem(BankImportItem.Create(import.Id, DateTime.UtcNow, "Item 2", 200m, null, null));
        import.AddItem(BankImportItem.Create(import.Id, DateTime.UtcNow, "Item 3", 300m, null, null));

        // Assert
        import.Items.Should().HaveCount(3);
    }

    #endregion

    #region MarkAsProcessed Tests

    [Fact]
    public void MarkAsProcessed_ShouldSetStatusToProcessed()
    {
        // Arrange
        var import = BankImport.Create("file.csv", "admin");

        // Act
        import.MarkAsProcessed();

        // Assert
        import.Status.Should().Be(BankImportStatus.Processed);
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var import = BankImport.Create("file.csv", "admin");

        // Act
        import.SoftDelete("admin");

        // Assert
        import.IsDeleted.Should().BeTrue();
        import.DeletedAt.Should().NotBeNull();
        import.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var import = BankImport.Create("file.csv", "admin");
        import.SoftDelete("admin");

        // Act
        import.Restore();

        // Assert
        import.IsDeleted.Should().BeFalse();
        import.DeletedAt.Should().BeNull();
        import.DeletedBy.Should().BeNull();
    }

    #endregion
}

/// <summary>
/// Unit tests for BankImportItem entity (REQ-041)
/// </summary>
public class BankImportItemTests
{
    private static readonly Guid BankImportId = Guid.NewGuid();

    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetProperties()
    {
        // Act
        var item = BankImportItem.Create(
            BankImportId, new DateTime(2026, 1, 15),
            "Mitgliedsbeitrag Max Mustermann", 100m,
            "CH93 0076 2011 6238 5295 7", "REF-001");

        // Assert
        item.BankImportId.Should().Be(BankImportId);
        item.TransactionDate.Should().Be(new DateTime(2026, 1, 15));
        item.Description.Should().Be("Mitgliedsbeitrag Max Mustermann");
        item.Amount.Should().Be(100m);
        item.Iban.Should().Be("CH93 0076 2011 6238 5295 7");
        item.Reference.Should().Be("REF-001");
        item.Status.Should().Be(BankImportItemStatus.Unmatched);
        item.MatchedPaymentId.Should().BeNull();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var item = BankImportItem.Create(BankImportId, DateTime.UtcNow, "Desc", 50m, null, null);

        // Assert
        item.Id.Should().NotBe(Guid.Empty);
    }

    #endregion

    #region MatchToPayment Tests

    [Fact]
    public void MatchToPayment_ShouldSetMatchedStatus()
    {
        // Arrange
        var item = BankImportItem.Create(BankImportId, DateTime.UtcNow, "Payment", 100m, null, null);
        var paymentId = Guid.NewGuid();

        // Act
        item.MatchToPayment(paymentId);

        // Assert
        item.Status.Should().Be(BankImportItemStatus.Matched);
        item.MatchedPaymentId.Should().Be(paymentId);
    }

    [Fact]
    public void MatchToPayment_AlreadyMatched_ShouldOverwrite()
    {
        // Arrange
        var item = BankImportItem.Create(BankImportId, DateTime.UtcNow, "Payment", 100m, null, null);
        var firstPaymentId = Guid.NewGuid();
        var secondPaymentId = Guid.NewGuid();
        item.MatchToPayment(firstPaymentId);

        // Act
        item.MatchToPayment(secondPaymentId);

        // Assert
        item.MatchedPaymentId.Should().Be(secondPaymentId);
    }

    #endregion

    #region Ignore Tests

    [Fact]
    public void Ignore_ShouldSetIgnoredStatus()
    {
        // Arrange
        var item = BankImportItem.Create(BankImportId, DateTime.UtcNow, "Fee", 5m, null, null);

        // Act
        item.Ignore();

        // Assert
        item.Status.Should().Be(BankImportItemStatus.Ignored);
        item.MatchedPaymentId.Should().BeNull();
    }

    [Fact]
    public void Ignore_PreviouslyMatched_ShouldClearPaymentId()
    {
        // Arrange
        var item = BankImportItem.Create(BankImportId, DateTime.UtcNow, "Payment", 100m, null, null);
        item.MatchToPayment(Guid.NewGuid());

        // Act
        item.Ignore();

        // Assert
        item.Status.Should().Be(BankImportItemStatus.Ignored);
        item.MatchedPaymentId.Should().BeNull();
    }

    #endregion

    #region Unmatch Tests

    [Fact]
    public void Unmatch_ShouldResetToUnmatched()
    {
        // Arrange
        var item = BankImportItem.Create(BankImportId, DateTime.UtcNow, "Payment", 100m, null, null);
        item.MatchToPayment(Guid.NewGuid());

        // Act
        item.Unmatch();

        // Assert
        item.Status.Should().Be(BankImportItemStatus.Unmatched);
        item.MatchedPaymentId.Should().BeNull();
    }

    #endregion
}
