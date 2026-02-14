using FluentAssertions;
using IabConnect.Domain.Documents;
using Xunit;

namespace IabConnect.Application.Tests.Documents;

/// <summary>
/// REQ-036: Unit tests for DocumentVersion domain entity.
/// Tests version creation and metadata.
/// </summary>
public class DocumentVersionTests
{
    private readonly Guid _documentId = Guid.NewGuid();

    #region Creation Tests

    [Fact]
    public void Create_WithValidData_CreatesVersion()
    {
        // Act
        var version = DocumentVersion.Create(
            _documentId,
            1,
            "documents/abc123.pdf",
            2048,
            "application/pdf",
            "Initial version");

        // Assert
        version.Should().NotBeNull();
        version.Id.Should().NotBeEmpty();
        version.DocumentId.Should().Be(_documentId);
        version.VersionNumber.Should().Be(1);
        version.StorageKey.Should().Be("documents/abc123.pdf");
        version.FileSize.Should().Be(2048);
        version.ContentType.Should().Be("application/pdf");
        version.Comment.Should().Be("Initial version");
        version.UploadedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        version.UploadedBy.Should().BeNull();
    }

    [Fact]
    public void Create_WithEmptyStorageKey_ThrowsArgumentException()
    {
        // Act
        var act = () => DocumentVersion.Create(
            _documentId,
            1,
            string.Empty,
            2048,
            "application/pdf");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("storageKey");
    }

    [Fact]
    public void Create_WithZeroVersionNumber_ThrowsArgumentException()
    {
        // Act
        var act = () => DocumentVersion.Create(
            _documentId,
            0,
            "documents/abc123.pdf",
            2048,
            "application/pdf");

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("versionNumber");
    }

    #endregion

    #region SetUploadedBy Tests

    [Fact]
    public void SetUploadedBy_SetsUserId()
    {
        // Arrange
        var version = DocumentVersion.Create(
            _documentId,
            1,
            "documents/abc123.pdf",
            2048,
            "application/pdf");
        var userId = Guid.NewGuid();

        // Act
        version.SetUploadedBy(userId);

        // Assert
        version.UploadedBy.Should().Be(userId);
    }

    #endregion
}
