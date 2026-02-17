using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using Microsoft.AspNetCore.Http.HttpResults;
using System.Text;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for audit log access (REQ-011)
/// </summary>
public static class AuditEndpoints
{
    public static void MapAuditEndpoints(this IEndpointRouteBuilder routes)
    {
        // Admin-only endpoints for viewing audit logs
        var adminGroup = routes.MapGroup("/api/v1/audit")
            .WithTags("Audit")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        adminGroup.MapGet("/", GetAuditEvents)
            .WithName("GetAuditEvents")
            .WithSummary("Get paginated audit events")
            .WithDescription("Returns a paginated list of audit events with optional filtering. Admin only.");

        adminGroup.MapGet("/export", ExportAuditEvents)
            .WithName("ExportAuditEvents")
            .WithSummary("Export audit events as CSV")
            .WithDescription("Exports audit events matching the filter criteria as CSV file. Admin only.");

        adminGroup.MapGet("/entity/{entityType}/{entityId}", GetEntityAuditHistory)
            .WithName("GetEntityAuditHistory")
            .WithSummary("Get audit history for an entity")
            .WithDescription("Returns the audit trail for a specific entity (e.g., Member, User).");

        adminGroup.MapGet("/user/{userId}", GetUserAuditHistory)
            .WithName("GetUserAuditHistory")
            .WithSummary("Get audit history for a user")
            .WithDescription("Returns all actions performed by a specific user.");

        adminGroup.MapGet("/categories", GetCategories)
            .WithName("GetAuditCategories")
            .WithSummary("Get available audit categories")
            .WithDescription("Returns all available audit event categories for filtering.");

        adminGroup.MapGet("/event-types", GetEventTypes)
            .WithName("GetAuditEventTypes")
            .WithSummary("Get available audit event types")
            .WithDescription("Returns all available audit event types for filtering.");

        // Authenticated user endpoints for login tracking
        var authGroup = routes.MapGroup("/api/v1/audit")
            .WithTags("Audit")
            .RequireAuthorization();

        authGroup.MapPost("/login", TrackLogin)
            .WithName("TrackLogin")
            .WithSummary("Track user login")
            .WithDescription("Records a successful login event for the current user. Called by frontend after authentication.");
    }

    /// <summary>
    /// Tracks a login event for the authenticated user
    /// </summary>
    private static async Task<Ok<LoginTrackResponse>> TrackLogin(
        IAuditService auditService,
        HttpContext httpContext,
        ILogger<AuditEvent> logger,
        CancellationToken ct = default)
    {
        var user = httpContext.User;
        var userId = user.FindFirst("sub")?.Value ?? user.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? "unknown";
        var userName = user.FindFirst("preferred_username")?.Value
            ?? user.FindFirst("email")?.Value
            ?? user.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value
            ?? "unknown";

        logger.LogInformation("Tracking login for user {UserId} ({UserName})", userId, userName);

        await auditService.LogLoginSuccessAsync(userId, userName, ct: ct);

        logger.LogInformation("Login tracked successfully for user {UserId}", userId);

        return TypedResults.Ok(new LoginTrackResponse(true, "Login tracked successfully"));
    }

    private static async Task<Ok<AuditEventListResponse>> GetAuditEvents(
        IAuditEventRepository repository,
        IAuditService auditService,
        HttpContext httpContext,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        AuditEventType? eventType = null,
        AuditCategory? category = null,
        AuditSeverity? severity = null,
        string? userId = null,
        string? entityType = null,
        string? entityId = null,
        bool? success = null,
        string? search = null,
        int page = 1,
        int pageSize = 50,
        CancellationToken ct = default)
    {
        var filter = new AuditEventFilter
        {
            FromDate = fromDate.HasValue ? DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc) : null,
            ToDate = toDate.HasValue ? DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc) : null,
            EventType = eventType,
            Category = category,
            Severity = severity,
            UserId = userId,
            EntityType = entityType,
            EntityId = entityId,
            Success = success,
            SearchTerm = search
        };

        var (items, totalCount) = await repository.GetAsync(filter, page, pageSize, ct);

        var dtos = items.Select(MapToDto).ToList();

        return TypedResults.Ok(new AuditEventListResponse
        {
            Items = dtos,
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
        });
    }

    private static async Task<IResult> ExportAuditEvents(
        IAuditEventRepository repository,
        IAuditService auditService,
        HttpContext httpContext,
        DateTime? fromDate = null,
        DateTime? toDate = null,
        AuditEventType? eventType = null,
        AuditCategory? category = null,
        AuditSeverity? severity = null,
        string? userId = null,
        string? entityType = null,
        bool? success = null,
        CancellationToken ct = default)
    {
        var filter = new AuditEventFilter
        {
            FromDate = fromDate.HasValue ? DateTime.SpecifyKind(fromDate.Value, DateTimeKind.Utc) : DateTime.UtcNow.AddMonths(-1),
            ToDate = toDate.HasValue ? DateTime.SpecifyKind(toDate.Value, DateTimeKind.Utc) : DateTime.UtcNow,
            EventType = eventType,
            Category = category,
            Severity = severity,
            UserId = userId,
            EntityType = entityType,
            Success = success
        };

        // Get all matching events (up to 10000)
        var (items, totalCount) = await repository.GetAsync(filter, 1, 10000, ct);

        // Log the export
        var currentUser = httpContext.User;
        var currentUserId = currentUser.FindFirst("sub")?.Value ?? "unknown";
        var currentUserName = currentUser.FindFirst("preferred_username")?.Value ?? currentUser.Identity?.Name ?? "unknown";

        await auditService.LogDataExportAsync("AuditEvents", currentUserId, currentUserName, items.Count, ct);

        // Generate CSV
        var csv = GenerateCsv(items);

        var fileName = $"audit_export_{DateTime.UtcNow:yyyyMMdd_HHmmss}.csv";
        return Results.File(
            Encoding.UTF8.GetBytes(csv),
            "text/csv",
            fileName);
    }

    private static async Task<Ok<List<AuditEventDto>>> GetEntityAuditHistory(
        string entityType,
        string entityId,
        IAuditEventRepository repository,
        CancellationToken ct = default)
    {
        var events = await repository.GetByEntityAsync(entityType, entityId, ct);
        var dtos = events.Select(MapToDto).ToList();
        return TypedResults.Ok(dtos);
    }

    private static async Task<Ok<List<AuditEventDto>>> GetUserAuditHistory(
        string userId,
        IAuditEventRepository repository,
        int limit = 100,
        CancellationToken ct = default)
    {
        var events = await repository.GetByUserAsync(userId, limit, ct);
        var dtos = events.Select(MapToDto).ToList();
        return TypedResults.Ok(dtos);
    }

    private static Ok<List<CategoryDto>> GetCategories()
    {
        var categories = Enum.GetValues<AuditCategory>()
            .Select(c => new CategoryDto
            {
                Value = c.ToString(),
                Label = GetCategoryLabel(c)
            })
            .ToList();

        return TypedResults.Ok(categories);
    }

    private static Ok<List<EventTypeDto>> GetEventTypes()
    {
        var eventTypes = Enum.GetValues<AuditEventType>()
            .Select(e => new EventTypeDto
            {
                Value = e.ToString(),
                Label = GetEventTypeLabel(e),
                Category = GetCategoryForEventType(e).ToString()
            })
            .ToList();

        return TypedResults.Ok(eventTypes);
    }

    private static AuditEventDto MapToDto(AuditEvent e)
    {
        return new AuditEventDto
        {
            Id = e.Id,
            Timestamp = e.Timestamp,
            EventType = e.EventType.ToString(),
            Category = e.Category.ToString(),
            Severity = e.Severity.ToString(),
            UserId = e.UserId,
            UserName = e.UserName,
            IpAddress = e.IpAddress,
            EntityType = e.EntityType,
            EntityId = e.EntityId,
            Action = e.Action,
            Details = e.Details,
            Success = e.Success,
            ErrorMessage = e.ErrorMessage
        };
    }

    private static string GenerateCsv(IReadOnlyList<AuditEvent> events)
    {
        var sb = new StringBuilder();

        // Header
        sb.AppendLine("Timestamp,EventType,Category,Severity,UserId,UserName,IpAddress,EntityType,EntityId,Action,Success,ErrorMessage");

        // Data rows
        foreach (var e in events)
        {
            sb.AppendLine($"\"{e.Timestamp:yyyy-MM-dd HH:mm:ss}\",\"{e.EventType}\",\"{e.Category}\",\"{e.Severity}\",\"{e.UserId ?? ""}\",\"{EscapeCsv(e.UserName)}\",\"{e.IpAddress ?? ""}\",\"{e.EntityType ?? ""}\",\"{e.EntityId ?? ""}\",\"{EscapeCsv(e.Action)}\",\"{e.Success}\",\"{EscapeCsv(e.ErrorMessage)}\"");
        }

        return sb.ToString();
    }

    private static string EscapeCsv(string? value)
    {
        if (string.IsNullOrEmpty(value)) return "";
        return value.Replace("\"", "\"\"");
    }

    private static string GetCategoryLabel(AuditCategory category) => category switch
    {
        AuditCategory.Authentication => "Authentifizierung",
        AuditCategory.UserManagement => "Benutzerverwaltung",
        AuditCategory.MemberManagement => "Mitgliederverwaltung",
        AuditCategory.DataAccess => "Datenzugriff",
        AuditCategory.System => "System",
        _ => category.ToString()
    };

    private static string GetEventTypeLabel(AuditEventType eventType) => eventType switch
    {
        AuditEventType.LoginSuccess => "Login erfolgreich",
        AuditEventType.LoginFailure => "Login fehlgeschlagen",
        AuditEventType.Logout => "Abmeldung",
        AuditEventType.PasswordReset => "Passwort zurückgesetzt",
        AuditEventType.PasswordChanged => "Passwort geändert",
        AuditEventType.AccountLocked => "Konto gesperrt",
        AuditEventType.AccountUnlocked => "Konto entsperrt",
        AuditEventType.UserCreated => "Benutzer erstellt",
        AuditEventType.UserUpdated => "Benutzer aktualisiert",
        AuditEventType.UserDeleted => "Benutzer gelöscht",
        AuditEventType.UserEnabled => "Benutzer aktiviert",
        AuditEventType.UserDisabled => "Benutzer deaktiviert",
        AuditEventType.RoleAssigned => "Rolle zugewiesen",
        AuditEventType.RoleRemoved => "Rolle entfernt",
        AuditEventType.MemberCreated => "Mitglied erstellt",
        AuditEventType.MemberUpdated => "Mitglied aktualisiert",
        AuditEventType.MemberDeleted => "Mitglied gelöscht",
        AuditEventType.MemberStatusChanged => "Mitgliedsstatus geändert",
        AuditEventType.MemberTypeChanged => "Mitgliedsart geändert",
        AuditEventType.DataExported => "Daten exportiert",
        AuditEventType.DataViewed => "Daten angezeigt",
        AuditEventType.SettingsChanged => "Einstellungen geändert",
        AuditEventType.SystemError => "Systemfehler",
        _ => eventType.ToString()
    };

    private static AuditCategory GetCategoryForEventType(AuditEventType eventType) => eventType switch
    {
        AuditEventType.LoginSuccess or AuditEventType.LoginFailure or AuditEventType.Logout or
        AuditEventType.PasswordReset or AuditEventType.PasswordChanged or
        AuditEventType.AccountLocked or AuditEventType.AccountUnlocked
            => AuditCategory.Authentication,

        AuditEventType.UserCreated or AuditEventType.UserUpdated or AuditEventType.UserDeleted or
        AuditEventType.UserEnabled or AuditEventType.UserDisabled or
        AuditEventType.RoleAssigned or AuditEventType.RoleRemoved
            => AuditCategory.UserManagement,

        AuditEventType.MemberCreated or AuditEventType.MemberUpdated or AuditEventType.MemberDeleted or
        AuditEventType.MemberStatusChanged or AuditEventType.MemberTypeChanged
            => AuditCategory.MemberManagement,

        AuditEventType.DataExported or AuditEventType.DataViewed
            => AuditCategory.DataAccess,

        _ => AuditCategory.System
    };
}

// DTOs
public record AuditEventListResponse
{
    public List<AuditEventDto> Items { get; init; } = [];
    public int TotalCount { get; init; }
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalPages { get; init; }
}

public record AuditEventDto
{
    public Guid Id { get; init; }
    public DateTime Timestamp { get; init; }
    public string EventType { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
    public string Severity { get; init; } = string.Empty;
    public string? UserId { get; init; }
    public string? UserName { get; init; }
    public string? IpAddress { get; init; }
    public string? EntityType { get; init; }
    public string? EntityId { get; init; }
    public string Action { get; init; } = string.Empty;
    public string? Details { get; init; }
    public bool Success { get; init; }
    public string? ErrorMessage { get; init; }
}

public record CategoryDto
{
    public string Value { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
}

public record EventTypeDto
{
    public string Value { get; init; } = string.Empty;
    public string Label { get; init; } = string.Empty;
    public string Category { get; init; } = string.Empty;
}

public record LoginTrackResponse(bool Success, string Message);
