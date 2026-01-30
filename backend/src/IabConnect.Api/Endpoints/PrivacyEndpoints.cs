using IabConnect.Application.Privacy;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Privacy;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Privacy and GDPR API endpoints
/// REQ-012: Datenschutz & Einwilligungen (DSGVO)
/// </summary>
public static class PrivacyEndpoints
{
    // Current policy version - should be configurable
    private const string CurrentPolicyVersion = "1.0.0";

    public static void MapPrivacyEndpoints(this RouteGroupBuilder group)
    {
        var privacy = group.MapGroup("/privacy")
            .WithTags("Privacy");

        // === Consent Management ===

        // GET /api/v1/privacy/consents - Get user's consents
        privacy.MapGet("/consents", GetConsents)
            .RequireAuthorization("RequireMember")
            .WithName("GetConsents")
            .WithDescription("REQ-012: Eigene Einwilligungen abrufen");

        // PUT /api/v1/privacy/consents - Update consents (bulk)
        privacy.MapPut("/consents", UpdateConsents)
            .RequireAuthorization("RequireMember")
            .WithName("UpdateConsents")
            .WithDescription("REQ-012: Einwilligungen aktualisieren");

        // POST /api/v1/privacy/consents/{type} - Grant specific consent
        privacy.MapPost("/consents/{type}", GrantConsent)
            .RequireAuthorization("RequireMember")
            .WithName("GrantConsent")
            .WithDescription("REQ-012: Einwilligung erteilen");

        // DELETE /api/v1/privacy/consents/{type} - Revoke specific consent
        privacy.MapDelete("/consents/{type}", RevokeConsent)
            .RequireAuthorization("RequireMember")
            .WithName("RevokeConsent")
            .WithDescription("REQ-012: Einwilligung widerrufen");

        // === Data Export (DSGVO Art. 20) ===

        // GET /api/v1/privacy/export - Export all user data
        privacy.MapGet("/export", ExportData)
            .RequireAuthorization("RequireMember")
            .WithName("ExportData")
            .WithDescription("REQ-012: DSGVO Datenexport (Art. 20)");

        // === Data Deletion (DSGVO Art. 17) ===

        // POST /api/v1/privacy/delete-request - Request account deletion
        privacy.MapPost("/delete-request", CreateDeletionRequest)
            .RequireAuthorization("RequireMember")
            .WithName("CreateDeletionRequest")
            .WithDescription("REQ-012: Löschantrag stellen (Art. 17)");

        // GET /api/v1/privacy/delete-request - Get own deletion request
        privacy.MapGet("/delete-request", GetOwnDeletionRequest)
            .RequireAuthorization("RequireMember")
            .WithName("GetOwnDeletionRequest")
            .WithDescription("REQ-012: Eigenen Löschantrag abrufen");

        // POST /api/v1/privacy/delete-request/confirm - Confirm deletion
        privacy.MapPost("/delete-request/confirm", ConfirmDeletionRequest)
            .RequireAuthorization("RequireMember")
            .WithName("ConfirmDeletionRequest")
            .WithDescription("REQ-012: Löschantrag bestätigen");

        // DELETE /api/v1/privacy/delete-request - Cancel deletion request
        privacy.MapDelete("/delete-request", CancelDeletionRequest)
            .RequireAuthorization("RequireMember")
            .WithName("CancelDeletionRequest")
            .WithDescription("REQ-012: Löschantrag abbrechen");

        // === Admin Endpoints ===

        // GET /api/v1/privacy/delete-requests - List all deletion requests
        privacy.MapGet("/delete-requests", GetDeletionRequests)
            .RequireAuthorization("RequireAdmin")
            .WithName("GetDeletionRequests")
            .WithDescription("REQ-012: Löschanträge verwalten (Admin)");

        // PUT /api/v1/privacy/delete-requests/{id} - Process deletion request
        privacy.MapPut("/delete-requests/{id:guid}", ProcessDeletionRequest)
            .RequireAuthorization("RequireAdmin")
            .WithName("ProcessDeletionRequest")
            .WithDescription("REQ-012: Löschantrag bearbeiten (Admin)");
    }

    // === Consent Handlers ===

    private static async Task<IResult> GetConsents(
        HttpContext httpContext,
        IConsentRepository consentRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var consents = await consentRepository.GetByUserIdAsync(userId.Value, ct);

        // Build consent overview with all consent types
        var consentStatuses = Enum.GetValues<ConsentType>()
            .Select(type =>
            {
                var consent = consents.FirstOrDefault(c => c.Type == type);
                return new ConsentStatusDto(
                    Type: type,
                    TypeName: GetConsentTypeName(type),
                    Description: GetConsentTypeDescription(type),
                    IsRequired: type == ConsentType.DataProcessing,
                    IsGranted: consent?.IsGranted ?? false,
                    GrantedAt: consent?.IsGranted == true ? consent.GrantedAt : null,
                    RevokedAt: consent?.RevokedAt
                );
            })
            .ToList();

        var hasRequired = consentStatuses
            .Where(c => c.IsRequired)
            .All(c => c.IsGranted);

        return Results.Ok(new ConsentOverviewDto(
            Consents: consentStatuses,
            CurrentPolicyVersion: CurrentPolicyVersion,
            HasRequiredConsents: hasRequired
        ));
    }

    private static async Task<IResult> UpdateConsents(
        [FromBody] UpdateConsentsRequest request,
        HttpContext httpContext,
        IConsentRepository consentRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();

        foreach (var update in request.Consents)
        {
            var existing = await consentRepository.GetByUserAndTypeAsync(userId.Value, update.Type, ct);

            if (existing == null)
            {
                if (update.IsGranted)
                {
                    var consent = Consent.Grant(userId.Value, update.Type, request.PolicyVersion, ipAddress, userAgent);
                    await consentRepository.AddAsync(consent, ct);
                }
            }
            else
            {
                if (update.IsGranted && !existing.IsGranted)
                {
                    existing.ReGrant(request.PolicyVersion, ipAddress, userAgent);
                }
                else if (!update.IsGranted && existing.IsGranted)
                {
                    existing.Revoke();
                }
                await consentRepository.UpdateAsync(existing, ct);
            }
        }

        return Results.NoContent();
    }

    private static async Task<IResult> GrantConsent(
        ConsentType type,
        HttpContext httpContext,
        IConsentRepository consentRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = httpContext.Request.Headers.UserAgent.ToString();

        var existing = await consentRepository.GetByUserAndTypeAsync(userId.Value, type, ct);

        if (existing == null)
        {
            var consent = Consent.Grant(userId.Value, type, CurrentPolicyVersion, ipAddress, userAgent);
            await consentRepository.AddAsync(consent, ct);
        }
        else if (!existing.IsGranted)
        {
            existing.ReGrant(CurrentPolicyVersion, ipAddress, userAgent);
            await consentRepository.UpdateAsync(existing, ct);
        }

        return Results.NoContent();
    }

    private static async Task<IResult> RevokeConsent(
        ConsentType type,
        HttpContext httpContext,
        IConsentRepository consentRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        // DataProcessing consent cannot be revoked while account is active
        if (type == ConsentType.DataProcessing)
        {
            return Results.BadRequest(new
            {
                Error = "DataProcessing consent cannot be revoked. Please submit a deletion request instead."
            });
        }

        var existing = await consentRepository.GetByUserAndTypeAsync(userId.Value, type, ct);

        if (existing != null && existing.IsGranted)
        {
            existing.Revoke();
            await consentRepository.UpdateAsync(existing, ct);
        }

        return Results.NoContent();
    }

    // === Data Export Handler ===

    private static async Task<IResult> ExportData(
        HttpContext httpContext,
        ApplicationDbContext dbContext,
        IConsentRepository consentRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var email = GetEmail(httpContext) ?? "unknown";

        // Get member profile
        var member = await dbContext.Members
            .FirstOrDefaultAsync(m => m.KeycloakUserId == userId.Value && !m.IsDeleted, ct);

        ProfileDataDto? profileData = null;
        if (member != null)
        {
            profileData = new ProfileDataDto(
                MemberId: member.Id,
                FirstName: member.FirstName,
                LastName: member.LastName,
                Email: member.Email,
                Phone: member.Phone,
                Address: member.Address != null ? new AddressDataDto(
                    Street: member.Address.Street,
                    PostalCode: member.Address.PostalCode,
                    City: member.Address.City,
                    Country: member.Address.Country
                ) : null,
                MembershipType: member.MembershipType.ToString(),
                Status: member.Status.ToString(),
                MemberSince: member.MemberSince,
                CreatedAt: member.CreatedAt
            );
        }

        // Get consents
        var consents = await consentRepository.GetByUserIdAsync(userId.Value, ct);
        var consentDtos = consents.Select(c => new ConsentDto(
            Id: c.Id,
            Type: c.Type,
            IsGranted: c.IsGranted,
            GrantedAt: c.GrantedAt,
            RevokedAt: c.RevokedAt,
            PolicyVersion: c.PolicyVersion,
            UpdatedAt: c.UpdatedAt
        )).ToList();

        // Get audit events for this user (limited to relevant actions)
        var auditEvents = await dbContext.AuditEvents
            .Where(a => a.UserId == userId.Value.ToString())
            .OrderByDescending(a => a.Timestamp)
            .Take(1000) // Limit to last 1000 events
            .Select(a => new AuditEventExportDto(
                Timestamp: a.Timestamp,
                EventType: a.EventType.ToString(),
                Category: a.Category.ToString(),
                Action: a.Action,
                Success: a.Success,
                IpAddress: a.IpAddress
            ))
            .ToListAsync(ct);

        var export = new DataExportDto(
            UserId: userId.Value,
            Email: email,
            ExportedAt: DateTime.UtcNow,
            Profile: profileData,
            Consents: consentDtos,
            AuditEvents: auditEvents
        );

        // Return as JSON with content-disposition for download
        return Results.Json(export, contentType: "application/json", statusCode: 200);
    }

    // === Deletion Request Handlers ===

    private static async Task<IResult> CreateDeletionRequest(
        [FromBody] CreateDeletionRequestDto request,
        HttpContext httpContext,
        IDeletionRequestRepository deletionRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var email = GetEmail(httpContext);
        if (string.IsNullOrEmpty(email))
            return Results.BadRequest(new { Error = "Email not found in token" });

        // Check for existing pending request
        var existingRequests = await deletionRepository.GetByUserIdAsync(userId.Value, ct);
        var pendingRequest = existingRequests.FirstOrDefault(r =>
            r.Status == DeletionRequestStatus.Pending ||
            r.Status == DeletionRequestStatus.Confirmed ||
            r.Status == DeletionRequestStatus.UnderReview);

        if (pendingRequest != null)
        {
            return Results.BadRequest(new
            {
                Error = "A deletion request is already pending",
                ExistingRequestId = pendingRequest.Id,
                Status = pendingRequest.Status.ToString()
            });
        }

        var ipAddress = httpContext.Connection.RemoteIpAddress?.ToString();
        var deletionRequest = DeletionRequest.Create(userId.Value, email, request.Reason, ipAddress);

        await deletionRepository.AddAsync(deletionRequest, ct);

        // TODO: Send confirmation email with token

        return Results.Created($"/api/v1/privacy/delete-request", new DeletionRequestDto(
            Id: deletionRequest.Id,
            UserId: deletionRequest.UserId,
            Email: deletionRequest.Email,
            Status: deletionRequest.Status,
            RequestedAt: deletionRequest.RequestedAt,
            ConfirmedAt: deletionRequest.ConfirmedAt,
            CompletedAt: deletionRequest.CompletedAt,
            Reason: deletionRequest.Reason,
            AdminNotes: null // Don't expose admin notes to user
        ));
    }

    private static async Task<IResult> GetOwnDeletionRequest(
        HttpContext httpContext,
        IDeletionRequestRepository deletionRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var requests = await deletionRepository.GetByUserIdAsync(userId.Value, ct);
        var activeRequest = requests
            .OrderByDescending(r => r.RequestedAt)
            .FirstOrDefault(r =>
                r.Status != DeletionRequestStatus.Completed &&
                r.Status != DeletionRequestStatus.Cancelled &&
                r.Status != DeletionRequestStatus.Rejected);

        if (activeRequest == null)
            return Results.NotFound(new { Error = "No active deletion request found" });

        return Results.Ok(new DeletionRequestDto(
            Id: activeRequest.Id,
            UserId: activeRequest.UserId,
            Email: activeRequest.Email,
            Status: activeRequest.Status,
            RequestedAt: activeRequest.RequestedAt,
            ConfirmedAt: activeRequest.ConfirmedAt,
            CompletedAt: activeRequest.CompletedAt,
            Reason: activeRequest.Reason,
            AdminNotes: null
        ));
    }

    private static async Task<IResult> ConfirmDeletionRequest(
        [FromBody] ConfirmDeletionRequestDto request,
        HttpContext httpContext,
        IDeletionRequestRepository deletionRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var deletionRequest = await deletionRepository.GetByTokenAsync(request.Token, ct);

        if (deletionRequest == null)
            return Results.NotFound(new { Error = "Invalid or expired confirmation token" });

        if (deletionRequest.UserId != userId.Value)
            return Results.Forbid();

        if (deletionRequest.Status != DeletionRequestStatus.Pending)
            return Results.BadRequest(new { Error = "Request cannot be confirmed in current state" });

        if (deletionRequest.TokenExpiresAt < DateTime.UtcNow)
            return Results.BadRequest(new { Error = "Confirmation token has expired" });

        var confirmed = deletionRequest.Confirm(request.Token);
        if (!confirmed)
            return Results.BadRequest(new { Error = "Failed to confirm deletion request" });

        await deletionRepository.UpdateAsync(deletionRequest, ct);

        return Results.Ok(new DeletionRequestDto(
            Id: deletionRequest.Id,
            UserId: deletionRequest.UserId,
            Email: deletionRequest.Email,
            Status: deletionRequest.Status,
            RequestedAt: deletionRequest.RequestedAt,
            ConfirmedAt: deletionRequest.ConfirmedAt,
            CompletedAt: deletionRequest.CompletedAt,
            Reason: deletionRequest.Reason,
            AdminNotes: null
        ));
    }

    private static async Task<IResult> CancelDeletionRequest(
        HttpContext httpContext,
        IDeletionRequestRepository deletionRepository,
        CancellationToken ct)
    {
        var userId = GetKeycloakUserId(httpContext);
        if (userId == null)
            return Results.Unauthorized();

        var requests = await deletionRepository.GetByUserIdAsync(userId.Value, ct);
        var activeRequest = requests.FirstOrDefault(r =>
            r.Status == DeletionRequestStatus.Pending ||
            r.Status == DeletionRequestStatus.Confirmed);

        if (activeRequest == null)
            return Results.NotFound(new { Error = "No cancellable deletion request found" });

        activeRequest.Cancel();
        await deletionRepository.UpdateAsync(activeRequest, ct);

        return Results.NoContent();
    }

    // === Admin Handlers ===

    private static async Task<IResult> GetDeletionRequests(
        [FromQuery] DeletionRequestStatus? status,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        IDeletionRequestRepository deletionRepository = default!,
        CancellationToken ct = default)
    {
        var requests = await deletionRepository.GetByStatusAsync(
            status ?? DeletionRequestStatus.Confirmed, ct);

        var totalCount = requests.Count;
        var pagedRequests = requests
            .OrderByDescending(r => r.RequestedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(r => new DeletionRequestDto(
                Id: r.Id,
                UserId: r.UserId,
                Email: r.Email,
                Status: r.Status,
                RequestedAt: r.RequestedAt,
                ConfirmedAt: r.ConfirmedAt,
                CompletedAt: r.CompletedAt,
                Reason: r.Reason,
                AdminNotes: r.AdminNotes
            ))
            .ToList();

        return Results.Ok(new
        {
            Items = pagedRequests,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    private static async Task<IResult> ProcessDeletionRequest(
        Guid id,
        [FromBody] ProcessDeletionRequestDto request,
        IDeletionRequestRepository deletionRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var deletionRequest = await deletionRepository.GetByIdAsync(id, ct);

        if (deletionRequest == null)
            return Results.NotFound();

        if (deletionRequest.Status != DeletionRequestStatus.Confirmed &&
            deletionRequest.Status != DeletionRequestStatus.UnderReview)
        {
            return Results.BadRequest(new { Error = "Request cannot be processed in current state" });
        }

        if (request.Approve)
        {
            // Set to under review first
            deletionRequest.SetUnderReview(request.AdminNotes);

            // Anonymize/delete user data
            await AnonymizeUserDataAsync(deletionRequest.UserId, dbContext, ct);

            // Mark as completed
            deletionRequest.Complete();

            // TODO: Delete Keycloak user or disable account
        }
        else
        {
            deletionRequest.Reject(request.AdminNotes ?? "Request rejected by admin");
        }

        await deletionRepository.UpdateAsync(deletionRequest, ct);

        return Results.Ok(new DeletionRequestDto(
            Id: deletionRequest.Id,
            UserId: deletionRequest.UserId,
            Email: deletionRequest.Email,
            Status: deletionRequest.Status,
            RequestedAt: deletionRequest.RequestedAt,
            ConfirmedAt: deletionRequest.ConfirmedAt,
            CompletedAt: deletionRequest.CompletedAt,
            Reason: deletionRequest.Reason,
            AdminNotes: deletionRequest.AdminNotes
        ));
    }

    // === Helper Methods ===

    private static Guid? GetKeycloakUserId(HttpContext httpContext)
    {
        var subClaim = httpContext.User.FindFirst("sub")?.Value;
        return Guid.TryParse(subClaim, out var userId) ? userId : null;
    }

    private static string? GetEmail(HttpContext httpContext)
    {
        return httpContext.User.FindFirst(ClaimTypes.Email)?.Value
            ?? httpContext.User.FindFirst("email")?.Value;
    }

    private static async Task AnonymizeUserDataAsync(
        Guid userId,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        // Anonymize member data instead of deleting
        var member = await dbContext.Members
            .FirstOrDefaultAsync(m => m.KeycloakUserId == userId, ct);

        if (member != null)
        {
            // Soft delete the member (anonymization happens in the entity)
            member.SoftDelete(userId);
            await dbContext.SaveChangesAsync(ct);
        }

        // Anonymize audit events (keep for compliance but remove PII)
        var auditEvents = await dbContext.AuditEvents
            .Where(a => a.UserId == userId.ToString())
            .ToListAsync(ct);

        foreach (var evt in auditEvents)
        {
            // Keep the event but anonymize user references
            evt.AnonymizeUser("deleted-user");
        }

        // Delete consents
        var consents = await dbContext.Consents
            .Where(c => c.UserId == userId)
            .ToListAsync(ct);

        dbContext.Consents.RemoveRange(consents);

        await dbContext.SaveChangesAsync(ct);
    }

    private static string GetConsentTypeName(ConsentType type) => type switch
    {
        ConsentType.DataProcessing => "Datenverarbeitung",
        ConsentType.Newsletter => "Newsletter",
        ConsentType.Marketing => "Marketing",
        ConsentType.EventNotifications => "Event-Benachrichtigungen",
        ConsentType.PhotoUsage => "Foto-Nutzung",
        _ => type.ToString()
    };

    private static string GetConsentTypeDescription(ConsentType type) => type switch
    {
        ConsentType.DataProcessing => "Erforderlich für die Nutzung der Plattform. Ihre Daten werden gemäß unserer Datenschutzrichtlinie verarbeitet.",
        ConsentType.Newsletter => "Erhalten Sie regelmäßige Updates über Vereinsaktivitäten per E-Mail.",
        ConsentType.Marketing => "Erhalten Sie Informationen über besondere Angebote und Partner.",
        ConsentType.EventNotifications => "Werden Sie über neue Events und Veranstaltungen benachrichtigt.",
        ConsentType.PhotoUsage => "Erlauben Sie die Verwendung von Fotos, auf denen Sie abgebildet sind, für Vereinszwecke.",
        _ => ""
    };
}
