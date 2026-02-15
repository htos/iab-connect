using FluentAssertions;
using IabConnect.Domain.Finance;
using Xunit;

namespace IabConnect.Application.Tests.Finance;

/// <summary>
/// Unit tests for Receipt entity (REQ-043, REQ-061)
/// </summary>
public class ReceiptTests
{
    #region Create Tests

    [Fact]
    public void Create_WithValidData_ShouldSetAllProperties()
    {
        // Act
        var receipt = Receipt.Create(
            "invoice_scan.pdf", "/receipts/123/invoice_scan.pdf",
            "application/pdf", 1024, "admin",
            fileHash: "abc123", notes: "Monthly invoice");

        // Assert
        receipt.FileName.Should().Be("invoice_scan.pdf");
        receipt.FilePath.Should().Be("/receipts/123/invoice_scan.pdf");
        receipt.ContentType.Should().Be("application/pdf");
        receipt.FileSize.Should().Be(1024);
        receipt.FileHash.Should().Be("abc123");
        receipt.UploadedBy.Should().Be("admin");
        receipt.Notes.Should().Be("Monthly invoice");
        receipt.IsDeleted.Should().BeFalse();
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var receipt = Receipt.Create("file.pdf", "/path", "application/pdf", 100, "admin");

        // Assert
        receipt.Id.Should().NotBe(Guid.Empty);
    }

    [Fact]
    public void Create_ShouldSetUploadedAtToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var receipt = Receipt.Create("file.pdf", "/path", "application/pdf", 100, "admin");

        // Assert
        receipt.UploadedAt.Should().BeAfter(before).And.BeBefore(DateTime.UtcNow.AddSeconds(1));
    }

    [Fact]
    public void Create_WithEmptyFileName_ShouldThrowArgumentException()
    {
        // Act & Assert
        var act = () => Receipt.Create("", "/path", "application/pdf", 100, "admin");
        act.Should().Throw<ArgumentException>()
            .WithParameterName("fileName");
    }

    [Fact]
    public void Create_WithNullNotes_ShouldBeNull()
    {
        // Act
        var receipt = Receipt.Create("file.pdf", "/path", "application/pdf", 100, "admin");

        // Assert
        receipt.Notes.Should().BeNull();
    }

    [Fact]
    public void Create_ShouldTrimNotes()
    {
        // Act
        var receipt = Receipt.Create("file.pdf", "/path", "application/pdf", 100, "admin",
            notes: "  Trimmed  ");

        // Assert
        receipt.Notes.Should().Be("Trimmed");
    }

    #endregion

    #region SetStorageMetadata Tests

    [Fact]
    public void SetStorageMetadata_ShouldUpdatePathHashAndSize()
    {
        // Arrange
        var receipt = Receipt.Create("file.pdf", "", "application/pdf", 0, "admin");

        // Act
        receipt.SetStorageMetadata("/storage/receipts/abc/file.pdf", "sha256-hash", 2048);

        // Assert
        receipt.FilePath.Should().Be("/storage/receipts/abc/file.pdf");
        receipt.FileHash.Should().Be("sha256-hash");
        receipt.FileSize.Should().Be(2048);
    }

    #endregion

    #region SoftDelete Tests

    [Fact]
    public void SoftDelete_ShouldSetIsDeletedTrue()
    {
        // Arrange
        var receipt = Receipt.Create("file.pdf", "/path", "application/pdf", 100, "admin");

        // Act
        receipt.SoftDelete("admin");

        // Assert
        receipt.IsDeleted.Should().BeTrue();
        receipt.DeletedAt.Should().NotBeNull();
        receipt.DeletedBy.Should().Be("admin");
    }

    [Fact]
    public void Restore_ShouldClearSoftDelete()
    {
        // Arrange
        var receipt = Receipt.Create("file.pdf", "/path", "application/pdf", 100, "admin");
        receipt.SoftDelete("admin");

        // Act
        receipt.Restore();

        // Assert
        receipt.IsDeleted.Should().BeFalse();
        receipt.DeletedAt.Should().BeNull();
        receipt.DeletedBy.Should().BeNull();
    }

    #endregion
}
