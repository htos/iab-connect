using FluentAssertions;
using IabConnect.Domain.Documents;
using Xunit;

namespace IabConnect.Application.Tests.Documents;

/// <summary>
/// REQ-034: Unit tests for DocumentFolder domain entity.
/// Tests folder creation, updates, moves, permissions, and access control.
/// </summary>
public class DocumentFolderTests
{
    private const string ValidName = "Protocols";

    private static DocumentFolder CreateValidFolder(
        string name = ValidName,
        string? description = null,
        Guid? parentFolderId = null,
        int sortOrder = 0)
    {
        return DocumentFolder.Create(name, description, parentFolderId, sortOrder);
    }

    #region Creation Tests

    [Fact]
    public void Create_WithValidData_CreatesFolder()
    {
        // Arrange
        var parentId = Guid.NewGuid();

        // Act
        var folder = DocumentFolder.Create("Board Documents", "Secret board docs", parentId, 5);

        // Assert
        folder.Should().NotBeNull();
        folder.Id.Should().NotBeEmpty();
        folder.Name.Should().Be("Board Documents");
        folder.Description.Should().Be("Secret board docs");
        folder.ParentFolderId.Should().Be(parentId);
        folder.SortOrder.Should().Be(5);
        folder.ChildFolders.Should().BeEmpty();
        folder.Documents.Should().BeEmpty();
        folder.Permissions.Should().BeEmpty();
    }

    [Fact]
    public void Create_WithEmptyName_ThrowsArgumentException()
    {
        // Act
        var act = () => DocumentFolder.Create(string.Empty);

        // Assert
        act.Should().Throw<ArgumentException>()
            .WithParameterName("name");
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_WithValidData_UpdatesFields()
    {
        // Arrange
        var folder = CreateValidFolder();

        // Act
        folder.Update("Renamed Folder", "New description", 10);

        // Assert
        folder.Name.Should().Be("Renamed Folder");
        folder.Description.Should().Be("New description");
        folder.SortOrder.Should().Be(10);
    }

    #endregion

    #region Move Tests

    [Fact]
    public void Move_ToNewParent_UpdatesParentId()
    {
        // Arrange
        var folder = CreateValidFolder();
        var newParentId = Guid.NewGuid();

        // Act
        folder.Move(newParentId);

        // Assert
        folder.ParentFolderId.Should().Be(newParentId);
    }

    [Fact]
    public void Move_ToSelf_ThrowsInvalidOperationException()
    {
        // Arrange
        var folder = CreateValidFolder();

        // Act
        var act = () => folder.Move(folder.Id);

        // Assert
        act.Should().Throw<InvalidOperationException>();
    }

    #endregion

    #region Permission Tests

    [Fact]
    public void SetPermission_NewRole_AddsPermission()
    {
        // Arrange
        var folder = CreateValidFolder();

        // Act
        folder.SetPermission(DocumentAccessRole.Member, DocumentPermissionType.Read);

        // Assert
        folder.Permissions.Should().HaveCount(1);
        folder.Permissions[0].Role.Should().Be(DocumentAccessRole.Member);
        folder.Permissions[0].PermissionType.Should().Be(DocumentPermissionType.Read);
    }

    [Fact]
    public void SetPermission_ExistingRole_UpdatesPermission()
    {
        // Arrange
        var folder = CreateValidFolder();
        folder.SetPermission(DocumentAccessRole.Member, DocumentPermissionType.Read);

        // Act
        folder.SetPermission(DocumentAccessRole.Member, DocumentPermissionType.Write);

        // Assert
        folder.Permissions.Should().HaveCount(1);
        folder.Permissions[0].PermissionType.Should().Be(DocumentPermissionType.Write);
    }

    [Fact]
    public void RemovePermission_ExistingRole_RemovesIt()
    {
        // Arrange
        var folder = CreateValidFolder();
        folder.SetPermission(DocumentAccessRole.Member, DocumentPermissionType.Read);
        folder.SetPermission(DocumentAccessRole.Vorstand, DocumentPermissionType.Write);

        // Act
        folder.RemovePermission(DocumentAccessRole.Member);

        // Assert
        folder.Permissions.Should().HaveCount(1);
        folder.Permissions[0].Role.Should().Be(DocumentAccessRole.Vorstand);
    }

    #endregion

    #region Access Control Tests

    [Fact]
    public void HasAccess_Admin_AlwaysTrue()
    {
        // Arrange
        var folder = CreateValidFolder();
        // No permissions set at all

        // Assert
        folder.HasAccess(DocumentAccessRole.Admin, DocumentPermissionType.Manage).Should().BeTrue();
    }

    [Fact]
    public void HasAccess_Vorstand_WithWritePermission_ReturnsTrue()
    {
        // Arrange
        var folder = CreateValidFolder();
        folder.SetPermission(DocumentAccessRole.Vorstand, DocumentPermissionType.Write);

        // Assert
        folder.HasAccess(DocumentAccessRole.Vorstand, DocumentPermissionType.Write).Should().BeTrue();
    }

    [Fact]
    public void HasAccess_Member_WithReadPermission_ReturnsTrue()
    {
        // Arrange
        var folder = CreateValidFolder();
        folder.SetPermission(DocumentAccessRole.Member, DocumentPermissionType.Read);

        // Assert
        folder.HasAccess(DocumentAccessRole.Member, DocumentPermissionType.Read).Should().BeTrue();
    }

    [Fact]
    public void HasAccess_Member_WithoutPermission_ReturnsFalse()
    {
        // Arrange
        var folder = CreateValidFolder();
        // No permission set for Member

        // Assert
        folder.HasAccess(DocumentAccessRole.Member, DocumentPermissionType.Read).Should().BeFalse();
    }

    [Fact]
    public void HasAccess_Member_RequireWrite_WithOnlyRead_ReturnsFalse()
    {
        // Arrange
        var folder = CreateValidFolder();
        folder.SetPermission(DocumentAccessRole.Member, DocumentPermissionType.Read);

        // Assert
        folder.HasAccess(DocumentAccessRole.Member, DocumentPermissionType.Write).Should().BeFalse();
    }

    #endregion
}
