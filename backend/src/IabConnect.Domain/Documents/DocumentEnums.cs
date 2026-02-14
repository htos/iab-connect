namespace IabConnect.Domain.Documents;

/// <summary>
/// Document workflow status
/// REQ-035: Entwurf/Geprüft/Veröffentlicht/Archiviert
/// </summary>
public enum DocumentStatus
{
    /// <summary>Draft - only visible to uploader and admins</summary>
    Draft = 0,

    /// <summary>Reviewed - approved by Vorstand</summary>
    Reviewed = 1,

    /// <summary>Published - visible to authorized roles</summary>
    Published = 2,

    /// <summary>Archived - no longer active but retained</summary>
    Archived = 3
}

/// <summary>
/// Document category
/// REQ-034: Metadaten (Kategorie)
/// </summary>
public enum DocumentCategory
{
    General = 0,
    Protocol = 1,
    Contract = 2,
    Invoice = 3,
    Regulation = 4,
    Template = 5,
    Report = 6,
    Photo = 7,
    Presentation = 8,
    Other = 9
}

/// <summary>
/// Access role for folder/document permissions
/// REQ-035: Dokumentrechte
/// </summary>
public enum DocumentAccessRole
{
    /// <summary>All authenticated members</summary>
    Member = 0,

    /// <summary>Board members (Vorstand)</summary>
    Vorstand = 1,

    /// <summary>Administrators only</summary>
    Admin = 2
}

/// <summary>
/// Permission type for folder/document access
/// </summary>
public enum DocumentPermissionType
{
    /// <summary>Can view/download</summary>
    Read = 0,

    /// <summary>Can upload/edit</summary>
    Write = 1,

    /// <summary>Can manage permissions and delete</summary>
    Manage = 2
}
