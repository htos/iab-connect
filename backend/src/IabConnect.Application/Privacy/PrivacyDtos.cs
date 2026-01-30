using IabConnect.Domain.Privacy;

namespace IabConnect.Application.Privacy;

/// <summary>
/// DTO for consent information
/// </summary>
public record ConsentDto(
    Guid Id,
    ConsentType Type,
    bool IsGranted,
    DateTime GrantedAt,
    DateTime? RevokedAt,
    string PolicyVersion,
    DateTime UpdatedAt);

/// <summary>
/// DTO for granting consent
/// </summary>
public record GrantConsentRequest(
    ConsentType Type,
    string PolicyVersion);

/// <summary>
/// DTO for bulk consent update
/// </summary>
public record UpdateConsentsRequest(
    List<ConsentUpdate> Consents,
    string PolicyVersion);

/// <summary>
/// Individual consent update
/// </summary>
public record ConsentUpdate(
    ConsentType Type,
    bool IsGranted);

/// <summary>
/// DTO for consent status overview
/// </summary>
public record ConsentOverviewDto(
    List<ConsentStatusDto> Consents,
    string CurrentPolicyVersion,
    bool HasRequiredConsents);

/// <summary>
/// Individual consent status
/// </summary>
public record ConsentStatusDto(
    ConsentType Type,
    string TypeName,
    string Description,
    bool IsRequired,
    bool IsGranted,
    DateTime? GrantedAt,
    DateTime? RevokedAt);

/// <summary>
/// DTO for deletion request
/// </summary>
public record DeletionRequestDto(
    Guid Id,
    Guid UserId,
    string Email,
    DeletionRequestStatus Status,
    DateTime RequestedAt,
    DateTime? ConfirmedAt,
    DateTime? CompletedAt,
    string? Reason,
    string? AdminNotes);

/// <summary>
/// DTO for creating a deletion request
/// </summary>
public record CreateDeletionRequestDto(
    string? Reason);

/// <summary>
/// DTO for confirming a deletion request
/// </summary>
public record ConfirmDeletionRequestDto(
    string Token);

/// <summary>
/// DTO for admin to process deletion request
/// </summary>
public record ProcessDeletionRequestDto(
    bool Approve,
    string? AdminNotes);

/// <summary>
/// DTO for data export request
/// </summary>
public record DataExportDto(
    Guid UserId,
    string Email,
    DateTime ExportedAt,
    ProfileDataDto? Profile,
    List<ConsentDto> Consents,
    List<AuditEventExportDto> AuditEvents);

/// <summary>
/// Profile data for export
/// </summary>
public record ProfileDataDto(
    Guid MemberId,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    AddressDataDto? Address,
    string MembershipType,
    string Status,
    DateOnly? MemberSince,
    DateTime CreatedAt);

/// <summary>
/// Address data for export
/// </summary>
public record AddressDataDto(
    string? Street,
    string? PostalCode,
    string? City,
    string? Country);

/// <summary>
/// Audit event for export
/// </summary>
public record AuditEventExportDto(
    DateTime Timestamp,
    string EventType,
    string Category,
    string Action,
    bool Success,
    string? IpAddress);
