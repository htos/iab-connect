using FluentAssertions;
using IabConnect.Domain.Documents;
using Xunit;

namespace IabConnect.Application.Tests.Documents;

/// <summary>
/// REQ-034 to REQ-037: Unit tests for Document domain entity.
/// Tests creation, status workflow, versioning, tags, expiry, and visibility.
/// </summary>
public class DocumentTests
{
    private readonly Guid _folderId = Guid.NewGuid();
    private const string ValidName = "Annual Report 2025";
    private const string ValidContentType = "application/pdf";
    private const long ValidFileSize = 1024;

    private Document CreateValidDocument(
        string name = ValidName,
        DocumentCategory category = DocumentCategory.General,
        string? description = null,
        DateTime? expiresAt = null)
    {
        return Document.Create(
            name,
            _folderId,
            ValidContentType,
            ValidFileSize,
            category,
            description,
            expiresAt);
    }

    #region Creation Tests

    [Fact]
    public void Create_WithValidData_CreatesDocument()
    {
        // Act
        var doc = CreateValidDocument(description: "Some description");

        // Assert
        doc.Should().NotBeNull();
        doc.Id.Should().NotBeEmpty();
        doc.Name.Should().Be(ValidName);
        doc.Description.Should().Be("Some description");
        doc.Category.Should().Be(DocumentCategory.General);
        doc.Status.Should().Be(DocumentStatus.Draft);
        doc.FolderId.Should().Be(_folderId);
        doc.ContentType.Should().Be(ValidContentType);
        doc.FileSize.Should().Be(ValidFileSize);
        doc.Versions.Should().BeEmpty();
        doc.Tags.Should().BeEmpty();
    }

    [Fact]
    public void Create_WithEmptyName_ThrowsArgumentException()
    {
        // Act
        var act = () => Document.Create(
            string.Empty,
            _folderId,
            ValidContentType,
            ValidFileSize);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    [Fact]
    public void Create_WithZeroFileSize_ThrowsArgumentException()
    {
        // Act
        var act = () => Document.Create(
            ValidName,
            _folderId,
            ValidContentType,
            0);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("fileSize");
    }

    #endregion

    #region UpdateMetadata Tests

    [Fact]
    public void UpdateMetadata_WithValidData_UpdatesFields()
    {
        // Arrange
        var doc = CreateValidDocument();
        var newExpiry = DateTime.UtcNow.AddMonths(6);

        // Act
        doc.UpdateMetadata("New Name", DocumentCategory.Protocol, "Updated desc", newExpiry);

        // Assert
        doc.Name.Should().Be("New Name");
        doc.Category.Should().Be(DocumentCategory.Protocol);
        doc.Description.Should().Be("Updated desc");
        doc.ExpiresAt.Should().Be(newExpiry);
    }

    #endregion

    #region Status Workflow Tests

    [Fact]
    public void Review_FromDraft_SetsReviewedStatus()
    {
        // Arrange
        var doc = CreateValidDocument();
        var reviewerId = Guid.NewGuid();

        // Act
        doc.Review(reviewerId);

        // Assert
        doc.Status.Should().Be(DocumentStatus.Reviewed);
        doc.ReviewedBy.Should().Be(reviewerId);
        doc.ReviewedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Review_FromPublished_ThrowsInvalidOperationException()
    {
        // Arrange
        var doc = CreateValidDocument();
        var userId = Guid.NewGuid();
        doc.Publish(userId); // Draft → Published

        // Act
        var act = () => doc.Review(userId);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Publish_FromDraft_SetsPublishedStatus()
    {
        // Arrange
        var doc = CreateValidDocument();
        var publisherId = Guid.NewGuid();

        // Act
        doc.Publish(publisherId);

        // Assert
        doc.Status.Should().Be(DocumentStatus.Published);
        doc.PublishedBy.Should().Be(publisherId);
        doc.PublishedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Publish_FromReviewed_SetsPublishedStatus()
    {
        // Arrange
        var doc = CreateValidDocument();
        var userId = Guid.NewGuid();
        doc.Review(userId);

        // Act
        doc.Publish(userId);

        // Assert
        doc.Status.Should().Be(DocumentStatus.Published);
        doc.PublishedBy.Should().Be(userId);
    }

    [Fact]
    public void Publish_FromArchived_ThrowsInvalidOperationException()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.Archive();

        // Act
        var act = () => doc.Publish(Guid.NewGuid());

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Archive_SetsArchivedStatus()
    {
        // Arrange
        var doc = CreateValidDocument();

        // Act
        doc.Archive();

        // Assert
        doc.Status.Should().Be(DocumentStatus.Archived);
    }

    [Fact]
    public void Archive_WhenAlreadyArchived_DoesNothing()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.Archive();
        var updatedAt = doc.UpdatedAt;

        // Act
        doc.Archive();

        // Assert
        doc.Status.Should().Be(DocumentStatus.Archived);
        doc.UpdatedAt.Should().Be(updatedAt);
    }

    [Fact]
    public void UnArchive_FromArchived_SetsDraftStatus()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.Archive();

        // Act
        doc.UnArchive();

        // Assert
        doc.Status.Should().Be(DocumentStatus.Draft);
    }

    [Fact]
    public void UnArchive_FromDraft_ThrowsInvalidOperationException()
    {
        // Arrange
        var doc = CreateValidDocument();

        // Act
        var act = () => doc.UnArchive();

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region Versioning Tests

    [Fact]
    public void AddVersion_CreatesVersionWithCorrectNumber()
    {
        // Arrange
        var doc = CreateValidDocument();

        // Act
        var version = doc.AddVersion("storage/key-1", 2048, "application/pdf", "Initial upload");

        // Assert
        version.Should().NotBeNull();
        version.VersionNumber.Should().Be(1);
        version.StorageKey.Should().Be("storage/key-1");
        version.FileSize.Should().Be(2048);
        version.ContentType.Should().Be("application/pdf");
        version.Comment.Should().Be("Initial upload");
        doc.Versions.Should().HaveCount(1);
        doc.FileSize.Should().Be(2048);
    }

    [Fact]
    public void AddVersion_SecondVersion_IncrementsVersionNumber()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddVersion("storage/key-1", 2048, "application/pdf");

        // Act
        var version2 = doc.AddVersion("storage/key-2", 4096, "application/pdf", "Updated version");

        // Assert
        version2.VersionNumber.Should().Be(2);
        doc.Versions.Should().HaveCount(2);
        doc.FileSize.Should().Be(4096);
    }

    [Fact]
    public void GetLatestVersion_ReturnsHighestVersionNumber()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddVersion("storage/key-1", 2048, "application/pdf");
        doc.AddVersion("storage/key-2", 4096, "application/pdf");
        doc.AddVersion("storage/key-3", 8192, "application/pdf");

        // Act
        var latest = doc.GetLatestVersion();

        // Assert
        latest.Should().NotBeNull();
        latest!.VersionNumber.Should().Be(3);
        latest.StorageKey.Should().Be("storage/key-3");
    }

    [Fact]
    public void GetVersion_WithValidNumber_ReturnsVersion()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddVersion("storage/key-1", 2048, "application/pdf");
        doc.AddVersion("storage/key-2", 4096, "application/pdf");

        // Act
        var version = doc.GetVersion(1);

        // Assert
        version.Should().NotBeNull();
        version!.VersionNumber.Should().Be(1);
        version.StorageKey.Should().Be("storage/key-1");
    }

    [Fact]
    public void GetVersion_WithInvalidNumber_ReturnsNull()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddVersion("storage/key-1", 2048, "application/pdf");

        // Act
        var version = doc.GetVersion(99);

        // Assert
        version.Should().BeNull();
    }

    [Fact]
    public void RestoreVersion_CreatesNewVersionFromOld()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddVersion("storage/key-1", 2048, "application/pdf");
        doc.AddVersion("storage/key-2", 4096, "application/pdf");

        // Act
        var restored = doc.RestoreVersion(1, "storage/key-3-restored", 2048, "application/pdf");

        // Assert
        restored.Should().NotBeNull();
        restored.VersionNumber.Should().Be(3);
        restored.StorageKey.Should().Be("storage/key-3-restored");
        restored.Comment.Should().Contain("Restored from version 1");
        doc.Versions.Should().HaveCount(3);
    }

    [Fact]
    public void RestoreVersion_WithInvalidNumber_ThrowsInvalidOperationException()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddVersion("storage/key-1", 2048, "application/pdf");

        // Act
        var act = () => doc.RestoreVersion(99, "storage/key-new", 2048, "application/pdf");

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region Tag Tests

    [Fact]
    public void AddTag_AddsNormalizedTag()
    {
        // Arrange
        var doc = CreateValidDocument();

        // Act
        doc.AddTag("  Important  ");

        // Assert
        doc.Tags.Should().HaveCount(1);
        doc.Tags[0].Name.Should().Be("important");
    }

    [Fact]
    public void AddTag_DuplicateTag_IgnoresDuplicate()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddTag("important");

        // Act
        doc.AddTag("Important"); // same tag, different casing

        // Assert
        doc.Tags.Should().HaveCount(1);
    }

    [Fact]
    public void RemoveTag_ExistingTag_RemovesIt()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddTag("important");
        doc.AddTag("urgent");

        // Act
        doc.RemoveTag("important");

        // Assert
        doc.Tags.Should().HaveCount(1);
        doc.Tags[0].Name.Should().Be("urgent");
    }

    [Fact]
    public void SetTags_ReplacesAllTags()
    {
        // Arrange
        var doc = CreateValidDocument();
        doc.AddTag("old-tag");
        doc.AddTag("another-old-tag");

        // Act
        doc.SetTags(new[] { "new-tag-1", "new-tag-2", "new-tag-3" });

        // Assert
        doc.Tags.Should().HaveCount(3);
        doc.Tags.Select(t => t.Name).Should().BeEquivalentTo("new-tag-1", "new-tag-2", "new-tag-3");
    }

    #endregion

    #region Expiry Tests

    [Fact]
    public void IsExpired_WithPastDate_ReturnsTrue()
    {
        // Arrange
        var doc = CreateValidDocument(expiresAt: DateTime.UtcNow.AddDays(-1));

        // Assert
        doc.IsExpired.Should().BeTrue();
    }

    [Fact]
    public void IsExpired_WithFutureDate_ReturnsFalse()
    {
        // Arrange
        var doc = CreateValidDocument(expiresAt: DateTime.UtcNow.AddDays(30));

        // Assert
        doc.IsExpired.Should().BeFalse();
    }

    [Fact]
    public void IsExpired_WithNoDate_ReturnsFalse()
    {
        // Arrange
        var doc = CreateValidDocument(expiresAt: null);

        // Assert
        doc.IsExpired.Should().BeFalse();
    }

    #endregion

    #region Visibility Tests

    [Fact]
    public void IsVisibleTo_Admin_AlwaysTrue()
    {
        // Arrange
        var doc = CreateValidDocument(); // Draft status

        // Assert
        doc.IsVisibleTo(DocumentAccessRole.Admin).Should().BeTrue();
    }

    [Fact]
    public void IsVisibleTo_Vorstand_AlwaysTrue()
    {
        // Arrange
        var doc = CreateValidDocument(); // Draft status

        // Assert
        doc.IsVisibleTo(DocumentAccessRole.Vorstand).Should().BeTrue();
    }

    [Fact]
    public void IsVisibleTo_Member_OnlyPublishedNonExpired()
    {
        // Arrange
        var doc = CreateValidDocument(expiresAt: DateTime.UtcNow.AddDays(30));
        doc.Publish(Guid.NewGuid());

        // Assert
        doc.IsVisibleTo(DocumentAccessRole.Member).Should().BeTrue();
    }

    [Fact]
    public void IsVisibleTo_Member_DraftNotVisible()
    {
        // Arrange
        var doc = CreateValidDocument(); // Draft status

        // Assert
        doc.IsVisibleTo(DocumentAccessRole.Member).Should().BeFalse();
    }

    [Fact]
    public void IsVisibleTo_Member_ExpiredNotVisible()
    {
        // Arrange
        var doc = CreateValidDocument(expiresAt: DateTime.UtcNow.AddDays(-1));
        doc.Publish(Guid.NewGuid());

        // Assert
        doc.IsVisibleTo(DocumentAccessRole.Member).Should().BeFalse();
    }

    #endregion
}
