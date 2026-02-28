using MediatR;

namespace IabConnect.Application.Finance.Archive.Queries;

/// <summary>
/// REQ-070: DTO for archived items.
/// </summary>
public sealed record ArchivedItemDto(
    Guid Id,
    string EntityType,
    string DisplayName,
    bool IsArchived,
    DateTimeOffset? ArchivedAt,
    string? ArchivedBy,
    string? ArchiveReason,
    DateTimeOffset RetainUntil);

/// <summary>
/// REQ-070: Query to get all archived items across entity types.
/// </summary>
public sealed record GetArchivedItemsQuery : IRequest<List<ArchivedItemDto>>;
