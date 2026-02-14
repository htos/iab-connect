using IabConnect.Application.Common;
using IabConnect.Domain.Documents;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Document management endpoints
/// REQ-034: Dokumentenverwaltung
/// REQ-035: Dokumentrechte & Freigabe
/// REQ-036: Versionierung
/// REQ-037: Volltextsuche & Tags
/// </summary>
public static class DocumentEndpoints
{
    public static WebApplication MapDocumentEndpoints(this WebApplication app)
    {
        var api = app.MapGroup("/api/v1");

        // Document Folders
        var folders = api.MapGroup("/document-folders")
            .WithTags("Document Folders");

        folders.MapGet("/", GetFolders)
            .RequireAuthorization("RequireMember")
            .WithName("GetDocumentFolders")
            .WithDescription("REQ-034: Get folder tree");

        folders.MapGet("/{id:guid}", GetFolderById)
            .RequireAuthorization("RequireMember")
            .WithName("GetDocumentFolderById")
            .WithDescription("REQ-034: Get folder by ID");

        folders.MapPost("/", CreateFolder)
            .RequireAuthorization("RequireAdmin")
            .WithName("CreateDocumentFolder")
            .WithDescription("REQ-034: Create folder (admin only)");

        folders.MapPut("/{id:guid}", UpdateFolder)
            .RequireAuthorization("RequireAdmin")
            .WithName("UpdateDocumentFolder")
            .WithDescription("REQ-034: Update folder (admin only)");

        folders.MapDelete("/{id:guid}", DeleteFolder)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteDocumentFolder")
            .WithDescription("REQ-034: Delete folder (admin only)");

        folders.MapPut("/{id:guid}/permissions", SetFolderPermissions)
            .RequireAuthorization("RequireAdmin")
            .WithName("SetFolderPermissions")
            .WithDescription("REQ-035: Set folder permissions (admin only)");

        // Documents
        var documents = api.MapGroup("/documents")
            .WithTags("Documents");

        documents.MapGet("/", GetDocuments)
            .RequireAuthorization("RequireMember")
            .WithName("GetDocuments2")
            .WithDescription("REQ-034: Get documents (paged, filtered)");

        documents.MapGet("/{id:guid}", GetDocumentById)
            .RequireAuthorization("RequireMember")
            .WithName("GetDocumentById")
            .WithDescription("REQ-034: Get document details");

        documents.MapPost("/", UploadDocument)
            .RequireAuthorization("RequireVorstand")
            .WithName("UploadDocument2")
            .WithDescription("REQ-034: Upload document")
            .DisableAntiforgery();

        documents.MapPut("/{id:guid}", UpdateDocument)
            .RequireAuthorization("RequireVorstand")
            .WithName("UpdateDocumentMetadata")
            .WithDescription("REQ-034: Update document metadata");

        documents.MapDelete("/{id:guid}", DeleteDocument)
            .RequireAuthorization("RequireVorstand")
            .WithName("DeleteDocument")
            .WithDescription("REQ-034: Delete document");

        documents.MapGet("/{id:guid}/download", DownloadDocument)
            .RequireAuthorization("RequireMember")
            .WithName("DownloadDocument2")
            .WithDescription("REQ-034: Download document");

        documents.MapPost("/{id:guid}/upload-version", UploadNewVersion)
            .RequireAuthorization("RequireVorstand")
            .WithName("UploadNewVersion")
            .WithDescription("REQ-036: Upload new version")
            .DisableAntiforgery();

        documents.MapGet("/{id:guid}/versions", GetVersions)
            .RequireAuthorization("RequireMember")
            .WithName("GetDocumentVersions")
            .WithDescription("REQ-036: Get version history");

        documents.MapGet("/{id:guid}/versions/{versionNumber:int}/download", DownloadVersion)
            .RequireAuthorization("RequireMember")
            .WithName("DownloadDocumentVersion")
            .WithDescription("REQ-036: Download specific version");

        documents.MapPost("/{id:guid}/versions/{versionNumber:int}/restore", RestoreVersion)
            .RequireAuthorization("RequireVorstand")
            .WithName("RestoreDocumentVersion")
            .WithDescription("REQ-036: Restore old version");

        // REQ-035: Status transitions
        documents.MapPost("/{id:guid}/review", ReviewDocument)
            .RequireAuthorization("RequireVorstand")
            .WithName("ReviewDocument")
            .WithDescription("REQ-035: Mark as reviewed");

        documents.MapPost("/{id:guid}/publish", PublishDocument)
            .RequireAuthorization("RequireVorstand")
            .WithName("PublishDocument")
            .WithDescription("REQ-035: Publish document");

        documents.MapPost("/{id:guid}/archive", ArchiveDocument)
            .RequireAuthorization("RequireVorstand")
            .WithName("ArchiveDocument")
            .WithDescription("REQ-035: Archive document");

        // REQ-037: Tags
        documents.MapGet("/tags", GetAllTags)
            .RequireAuthorization("RequireMember")
            .WithName("GetAllDocumentTags")
            .WithDescription("REQ-037: Get all available tags");

        documents.MapPut("/{id:guid}/tags", UpdateDocumentTags)
            .RequireAuthorization("RequireVorstand")
            .WithName("UpdateDocumentTags")
            .WithDescription("REQ-037: Update document tags");

        return app;
    }

    // --- Folder Handlers ---

    private static async Task<IResult> GetFolders(
        IDocumentFolderRepository folderRepo,
        [FromQuery] Guid? parentId,
        HttpContext httpContext)
    {
        var userRole = GetUserDocumentRole(httpContext);

        IReadOnlyList<DocumentFolder> folders;
        if (parentId.HasValue)
            folders = await folderRepo.GetChildFoldersAsync(parentId.Value);
        else
            folders = await folderRepo.GetRootFoldersAsync();

        // Filter by access for non-admin users
        // REQ-035: Only show folders where the user's role has at least Read permission
        if (userRole != DocumentAccessRole.Admin)
        {
            if (userRole == DocumentAccessRole.Member)
            {
                folders = folders.Where(f =>
                    f.Permissions.Any(p => p.Role == DocumentAccessRole.Member &&
                                          p.PermissionType >= DocumentPermissionType.Read)
                ).ToList();
            }
            else if (userRole == DocumentAccessRole.Vorstand)
            {
                folders = folders.Where(f =>
                    f.Permissions.Any(p => (p.Role == DocumentAccessRole.Vorstand || p.Role == DocumentAccessRole.Member) &&
                                          p.PermissionType >= DocumentPermissionType.Read)
                ).ToList();
            }
        }

        var result = folders.Select(f => new DocumentFolderDto(
            f.Id, f.Name, f.Description, f.ParentFolderId, f.SortOrder,
            f.Permissions.Select(p => new FolderPermissionDto(p.Role.ToString(), p.PermissionType.ToString())).ToList(),
            f.CreatedAt
        ));

        return Results.Ok(result);
    }

    private static async Task<IResult> GetFolderById(
        Guid id,
        IDocumentFolderRepository folderRepo)
    {
        var folder = await folderRepo.GetByIdWithPermissionsAsync(id);
        if (folder == null)
            return Results.NotFound(new { message = "Folder not found" });

        return Results.Ok(new DocumentFolderDto(
            folder.Id, folder.Name, folder.Description, folder.ParentFolderId, folder.SortOrder,
            folder.Permissions.Select(p => new FolderPermissionDto(p.Role.ToString(), p.PermissionType.ToString())).ToList(),
            folder.CreatedAt
        ));
    }

    private static async Task<IResult> CreateFolder(
        CreateFolderRequest request,
        IDocumentFolderRepository folderRepo,
        IUnitOfWork unitOfWork)
    {
        if (request.ParentFolderId.HasValue)
        {
            var parentExists = await folderRepo.ExistsAsync(request.ParentFolderId.Value);
            if (!parentExists)
                return Results.BadRequest(new { message = "Parent folder not found" });
        }

        var folder = DocumentFolder.Create(
            request.Name,
            request.Description,
            request.ParentFolderId,
            request.SortOrder);

        await folderRepo.AddAsync(folder);
        await unitOfWork.SaveChangesAsync();

        return Results.Created($"/api/v1/document-folders/{folder.Id}", new DocumentFolderDto(
            folder.Id, folder.Name, folder.Description, folder.ParentFolderId, folder.SortOrder,
            new List<FolderPermissionDto>(),
            folder.CreatedAt
        ));
    }

    private static async Task<IResult> UpdateFolder(
        Guid id,
        UpdateFolderRequest request,
        IDocumentFolderRepository folderRepo,
        IUnitOfWork unitOfWork)
    {
        var folder = await folderRepo.GetByIdAsync(id);
        if (folder == null)
            return Results.NotFound(new { message = "Folder not found" });

        folder.Update(request.Name, request.Description, request.SortOrder);
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Folder updated" });
    }

    private static async Task<IResult> DeleteFolder(
        Guid id,
        IDocumentFolderRepository folderRepo,
        IUnitOfWork unitOfWork)
    {
        var folder = await folderRepo.GetByIdAsync(id);
        if (folder == null)
            return Results.NotFound(new { message = "Folder not found" });

        var hasDocs = await folderRepo.HasDocumentsAsync(id);
        if (hasDocs)
            return Results.BadRequest(new { message = "Cannot delete folder with documents. Move or delete documents first." });

        folder.SoftDelete();
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Folder deleted" });
    }

    private static async Task<IResult> SetFolderPermissions(
        Guid id,
        SetFolderPermissionsRequest request,
        IDocumentFolderRepository folderRepo,
        IUnitOfWork unitOfWork)
    {
        var folder = await folderRepo.GetByIdWithPermissionsAsync(id);
        if (folder == null)
            return Results.NotFound(new { message = "Folder not found" });

        foreach (var perm in request.Permissions)
        {
            if (!Enum.TryParse<DocumentAccessRole>(perm.Role, true, out var role))
                return Results.BadRequest(new { message = $"Invalid role: {perm.Role}" });
            if (!Enum.TryParse<DocumentPermissionType>(perm.PermissionType, true, out var permType))
                return Results.BadRequest(new { message = $"Invalid permission type: {perm.PermissionType}" });

            folder.SetPermission(role, permType);
        }

        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Permissions updated" });
    }

    // --- Document Handlers ---

    private static async Task<IResult> GetDocuments(
        IDocumentRepository documentRepo,
        HttpContext httpContext,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] string? search = null,
        [FromQuery] Guid? folderId = null,
        [FromQuery] string? category = null,
        [FromQuery] string? status = null,
        [FromQuery] string? tags = null)
    {
        var userRole = GetUserDocumentRole(httpContext);

        var filter = new DocumentFilterOptions
        {
            Page = page,
            PageSize = Math.Min(pageSize, 100),
            SearchTerm = search,
            FolderId = folderId,
            UserRole = userRole
        };

        if (!string.IsNullOrEmpty(category) && Enum.TryParse<DocumentCategory>(category, true, out var cat))
            filter.Category = cat;

        if (!string.IsNullOrEmpty(status) && Enum.TryParse<DocumentStatus>(status, true, out var st))
            filter.Status = st;

        if (!string.IsNullOrEmpty(tags))
            filter.Tags = tags.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

        var (items, totalCount) = await documentRepo.GetPagedAsync(filter);

        var result = new
        {
            items = items.Select(d => MapToDto(d)),
            totalCount,
            page = filter.Page,
            pageSize = filter.PageSize,
            totalPages = (int)Math.Ceiling((double)totalCount / filter.PageSize)
        };

        return Results.Ok(result);
    }

    private static async Task<IResult> GetDocumentById(
        Guid id,
        IDocumentRepository documentRepo,
        HttpContext httpContext)
    {
        var document = await documentRepo.GetByIdWithVersionsAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var userRole = GetUserDocumentRole(httpContext);
        if (!document.IsVisibleTo(userRole))
            return Results.Forbid();

        return Results.Ok(MapToDetailDto(document));
    }

    private static async Task<IResult> UploadDocument(
        HttpRequest request,
        IDocumentRepository documentRepo,
        IDocumentFolderRepository folderRepo,
        IDocumentStorage storage,
        IUnitOfWork unitOfWork)
    {
        if (!request.HasFormContentType)
            return Results.BadRequest(new { message = "Request must be multipart/form-data" });

        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");
        if (file == null || file.Length == 0)
            return Results.BadRequest(new { message = "File is required" });

        var name = form["name"].FirstOrDefault() ?? Path.GetFileNameWithoutExtension(file.FileName);
        var description = form["description"].FirstOrDefault();
        var folderIdStr = form["folderId"].FirstOrDefault();
        var categoryStr = form["category"].FirstOrDefault();
        var tagsStr = form["tags"].FirstOrDefault();

        if (string.IsNullOrEmpty(folderIdStr) || !Guid.TryParse(folderIdStr, out var folderId))
            return Results.BadRequest(new { message = "folderId is required" });

        var folderExists = await folderRepo.ExistsAsync(folderId);
        if (!folderExists)
            return Results.BadRequest(new { message = "Folder not found" });

        var category = DocumentCategory.General;
        if (!string.IsNullOrEmpty(categoryStr))
            Enum.TryParse(categoryStr, true, out category);

        var document = Document.Create(
            name,
            folderId,
            file.ContentType,
            file.Length,
            category,
            description);

        // Upload to storage
        var storageKey = $"documents/{document.Id}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        using var stream = file.OpenReadStream();
        await storage.UploadAsync(storageKey, stream, file.ContentType);

        // Add initial version
        document.AddVersion(storageKey, file.Length, file.ContentType, "Initial upload");

        // Add tags
        if (!string.IsNullOrEmpty(tagsStr))
        {
            var tagList = tagsStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            document.SetTags(tagList);
        }

        await documentRepo.AddAsync(document);
        await unitOfWork.SaveChangesAsync();

        return Results.Created($"/api/v1/documents/{document.Id}", MapToDto(document));
    }

    private static async Task<IResult> UpdateDocument(
        Guid id,
        UpdateDocumentRequest req,
        IDocumentRepository documentRepo,
        IUnitOfWork unitOfWork)
    {
        var document = await documentRepo.GetByIdAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var category = DocumentCategory.General;
        if (!string.IsNullOrEmpty(req.Category))
            Enum.TryParse(req.Category, true, out category);

        document.UpdateMetadata(req.Name, category, req.Description, req.ExpiresAt);

        if (req.Tags != null)
            document.SetTags(req.Tags);

        await unitOfWork.SaveChangesAsync();

        return Results.Ok(MapToDto(document));
    }

    private static async Task<IResult> DeleteDocument(
        Guid id,
        IDocumentRepository documentRepo,
        IUnitOfWork unitOfWork)
    {
        var document = await documentRepo.GetByIdAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        document.SoftDelete();
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Document deleted" });
    }

    private static async Task<IResult> DownloadDocument(
        Guid id,
        IDocumentRepository documentRepo,
        IDocumentStorage storage,
        HttpContext httpContext)
    {
        var document = await documentRepo.GetByIdWithVersionsAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var userRole = GetUserDocumentRole(httpContext);
        if (!document.IsVisibleTo(userRole))
            return Results.Forbid();

        var latestVersion = document.GetLatestVersion();
        if (latestVersion == null)
            return Results.NotFound(new { message = "No version available" });

        var stream = await storage.DownloadAsync(latestVersion.StorageKey);
        return Results.File(stream, document.ContentType, document.Name);
    }

    private static async Task<IResult> UploadNewVersion(
        Guid id,
        HttpRequest request,
        IDocumentRepository documentRepo,
        IDocumentStorage storage,
        IUnitOfWork unitOfWork)
    {
        if (!request.HasFormContentType)
            return Results.BadRequest(new { message = "Request must be multipart/form-data" });

        var document = await documentRepo.GetByIdWithVersionsAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var form = await request.ReadFormAsync();
        var file = form.Files.GetFile("file");
        if (file == null || file.Length == 0)
            return Results.BadRequest(new { message = "File is required" });

        var comment = form["comment"].FirstOrDefault();

        var storageKey = $"documents/{document.Id}/{Guid.NewGuid()}{Path.GetExtension(file.FileName)}";
        using var stream = file.OpenReadStream();
        await storage.UploadAsync(storageKey, stream, file.ContentType);

        var version = document.AddVersion(storageKey, file.Length, file.ContentType, comment);
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new DocumentVersionDto(
            version.Id, version.VersionNumber, version.FileSize,
            version.ContentType, version.Comment, version.UploadedAt));
    }

    private static async Task<IResult> GetVersions(
        Guid id,
        IDocumentRepository documentRepo,
        HttpContext httpContext)
    {
        var document = await documentRepo.GetByIdWithVersionsAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var userRole = GetUserDocumentRole(httpContext);
        if (!document.IsVisibleTo(userRole))
            return Results.Forbid();

        var versions = document.Versions
            .OrderByDescending(v => v.VersionNumber)
            .Select(v => new DocumentVersionDto(
                v.Id, v.VersionNumber, v.FileSize, v.ContentType, v.Comment, v.UploadedAt))
            .ToList();

        return Results.Ok(versions);
    }

    private static async Task<IResult> DownloadVersion(
        Guid id,
        int versionNumber,
        IDocumentRepository documentRepo,
        IDocumentStorage storage,
        HttpContext httpContext)
    {
        var document = await documentRepo.GetByIdWithVersionsAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var userRole = GetUserDocumentRole(httpContext);
        if (!document.IsVisibleTo(userRole))
            return Results.Forbid();

        var version = document.GetVersion(versionNumber);
        if (version == null)
            return Results.NotFound(new { message = $"Version {versionNumber} not found" });

        var stream = await storage.DownloadAsync(version.StorageKey);
        return Results.File(stream, version.ContentType, $"{document.Name}_v{versionNumber}");
    }

    private static async Task<IResult> RestoreVersion(
        Guid id,
        int versionNumber,
        IDocumentRepository documentRepo,
        IDocumentStorage storage,
        IUnitOfWork unitOfWork)
    {
        var document = await documentRepo.GetByIdWithVersionsAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var oldVersion = document.GetVersion(versionNumber);
        if (oldVersion == null)
            return Results.NotFound(new { message = $"Version {versionNumber} not found" });

        // Copy old version content to a new storage key
        var oldStream = await storage.DownloadAsync(oldVersion.StorageKey);
        var newStorageKey = $"documents/{document.Id}/{Guid.NewGuid()}{Path.GetExtension(oldVersion.StorageKey)}";
        await storage.UploadAsync(newStorageKey, oldStream, oldVersion.ContentType);

        var newVersion = document.RestoreVersion(versionNumber, newStorageKey, oldVersion.FileSize, oldVersion.ContentType);
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new DocumentVersionDto(
            newVersion.Id, newVersion.VersionNumber, newVersion.FileSize,
            newVersion.ContentType, newVersion.Comment, newVersion.UploadedAt));
    }

    // REQ-035: Workflow endpoints
    private static async Task<IResult> ReviewDocument(
        Guid id,
        IDocumentRepository documentRepo,
        IUnitOfWork unitOfWork,
        HttpContext httpContext)
    {
        var document = await documentRepo.GetByIdAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var userId = GetUserId(httpContext);
        document.Review(userId);
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Document reviewed", status = document.Status.ToString() });
    }

    private static async Task<IResult> PublishDocument(
        Guid id,
        IDocumentRepository documentRepo,
        IUnitOfWork unitOfWork,
        HttpContext httpContext)
    {
        var document = await documentRepo.GetByIdAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        var userId = GetUserId(httpContext);
        document.Publish(userId);
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Document published", status = document.Status.ToString() });
    }

    private static async Task<IResult> ArchiveDocument(
        Guid id,
        IDocumentRepository documentRepo,
        IUnitOfWork unitOfWork)
    {
        var document = await documentRepo.GetByIdAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        document.Archive();
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Document archived", status = document.Status.ToString() });
    }

    // REQ-037: Tags
    private static async Task<IResult> GetAllTags(IDocumentRepository documentRepo)
    {
        var tags = await documentRepo.GetAllTagsAsync();
        return Results.Ok(tags);
    }

    private static async Task<IResult> UpdateDocumentTags(
        Guid id,
        UpdateTagsRequest request,
        IDocumentRepository documentRepo,
        IUnitOfWork unitOfWork)
    {
        var document = await documentRepo.GetByIdAsync(id);
        if (document == null)
            return Results.NotFound(new { message = "Document not found" });

        document.SetTags(request.Tags);
        await unitOfWork.SaveChangesAsync();

        return Results.Ok(new { message = "Tags updated", tags = document.Tags.Select(t => t.Name).ToList() });
    }

    // --- Helper Methods ---

    private static DocumentAccessRole GetUserDocumentRole(HttpContext httpContext)
    {
        var user = httpContext.User;
        if (user.IsInRole("admin")) return DocumentAccessRole.Admin;
        if (user.IsInRole("vorstand")) return DocumentAccessRole.Vorstand;
        return DocumentAccessRole.Member;
    }

    private static Guid GetUserId(HttpContext httpContext)
    {
        var sub = httpContext.User.FindFirst("sub")?.Value
            ?? httpContext.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        return sub != null ? Guid.Parse(sub) : Guid.Empty;
    }

    private static DocumentDto MapToDto(Document d) => new(
        d.Id, d.Name, d.Description, d.Category.ToString(), d.Status.ToString(),
        d.FolderId, d.ContentType, d.FileSize,
        d.Tags.Select(t => t.Name).ToList(),
        d.ExpiresAt, d.CreatedAt, d.CreatedBy);

    private static DocumentDetailDto MapToDetailDto(Document d) => new(
        d.Id, d.Name, d.Description, d.Category.ToString(), d.Status.ToString(),
        d.FolderId, d.ContentType, d.FileSize,
        d.Tags.Select(t => t.Name).ToList(),
        d.ExpiresAt, d.CreatedAt, d.CreatedBy,
        d.ReviewedBy, d.ReviewedAt, d.PublishedBy, d.PublishedAt,
        d.Versions.OrderByDescending(v => v.VersionNumber)
            .Select(v => new DocumentVersionDto(v.Id, v.VersionNumber, v.FileSize, v.ContentType, v.Comment, v.UploadedAt))
            .ToList());
}

// --- DTOs ---

public record DocumentFolderDto(
    Guid Id, string Name, string? Description, Guid? ParentFolderId, int SortOrder,
    List<FolderPermissionDto> Permissions, DateTime CreatedAt);

public record FolderPermissionDto(string Role, string PermissionType);

public record CreateFolderRequest(string Name, string? Description = null, Guid? ParentFolderId = null, int SortOrder = 0);

public record UpdateFolderRequest(string Name, string? Description = null, int? SortOrder = null);

public record SetFolderPermissionsRequest(List<PermissionEntry> Permissions);
public record PermissionEntry(string Role, string PermissionType);

public record DocumentDto(
    Guid Id, string Name, string? Description, string Category, string Status,
    Guid FolderId, string ContentType, long FileSize,
    List<string> Tags, DateTime? ExpiresAt, DateTime CreatedAt, Guid? CreatedBy);

public record DocumentDetailDto(
    Guid Id, string Name, string? Description, string Category, string Status,
    Guid FolderId, string ContentType, long FileSize,
    List<string> Tags, DateTime? ExpiresAt, DateTime CreatedAt, Guid? CreatedBy,
    Guid? ReviewedBy, DateTime? ReviewedAt, Guid? PublishedBy, DateTime? PublishedAt,
    List<DocumentVersionDto> Versions);

public record DocumentVersionDto(Guid Id, int VersionNumber, long FileSize, string ContentType, string? Comment, DateTime UploadedAt);

public record UpdateDocumentRequest(string Name, string? Category = null, string? Description = null, DateTime? ExpiresAt = null, List<string>? Tags = null);

public record UpdateTagsRequest(List<string> Tags);
