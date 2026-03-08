using IabConnect.Application.Authorization;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using DomainMembershipStatus = IabConnect.Domain.Members.MembershipStatus;
using DomainMembershipType = IabConnect.Domain.Members.MembershipType;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Member segment management API endpoints
/// REQ-017: Segmentierung & Verteiler
/// </summary>
public static class MemberSegmentEndpoints
{
    public static WebApplication MapMemberSegmentEndpoints(this WebApplication app)
    {
        var group = app.MapGroup("/api/v1/member-segments")
            .WithTags("Member Segments")
            .RequireAuthorization("RequireVorstand");

        // GET /api/v1/member-segments - List all segments (paginated)
        group.MapGet("/", GetSegments)
            .WithName("GetMemberSegments")
            .WithDescription("REQ-017: Segmentliste mit Suche und Filterung");

        // GET /api/v1/member-segments/active - List all active segments (for pickers)
        group.MapGet("/active", GetActiveSegments)
            .WithName("GetActiveMemberSegments")
            .WithDescription("REQ-017: Aktive Segmente für Auswahl");

        // POST /api/v1/member-segments - Create segment
        group.MapPost("/", CreateSegment)
            .WithName("CreateMemberSegment")
            .WithDescription("REQ-017: Neues Segment erstellen");

        // GET /api/v1/member-segments/{id} - Get segment details
        group.MapGet("/{id:guid}", GetSegmentById)
            .WithName("GetMemberSegmentById")
            .WithDescription("REQ-017: Segment-Details abrufen");

        // PUT /api/v1/member-segments/{id} - Update segment
        group.MapPut("/{id:guid}", UpdateSegment)
            .WithName("UpdateMemberSegment")
            .WithDescription("REQ-017: Segment bearbeiten");

        // DELETE /api/v1/member-segments/{id} - Delete segment
        group.MapDelete("/{id:guid}", DeleteSegment)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteMemberSegment")
            .WithDescription("REQ-017: Segment löschen (nur Admin)");

        // GET /api/v1/member-segments/{id}/members - Get members in segment
        group.MapGet("/{id:guid}/members", GetSegmentMembers)
            .WithName("GetMemberSegmentMembers")
            .WithDescription("REQ-017: Mitglieder im Segment anzeigen");

        // POST /api/v1/member-segments/{id}/members - Add member to static segment
        group.MapPost("/{id:guid}/members", AddMemberToSegment)
            .WithName("AddMemberToSegment")
            .WithDescription("REQ-017: Mitglied zu statischem Segment hinzufügen");

        // DELETE /api/v1/member-segments/{id}/members/{memberId} - Remove member from segment
        group.MapDelete("/{id:guid}/members/{memberId:guid}", RemoveMemberFromSegment)
            .WithName("RemoveMemberFromSegment")
            .WithDescription("REQ-017: Mitglied aus Segment entfernen");

        // GET /api/v1/member-segments/{id}/export - Export segment members as CSV
        group.MapGet("/{id:guid}/export", ExportSegmentMembers)
            .WithName("ExportMemberSegmentMembers")
            .WithDescription("REQ-017: Segment-Mitglieder als CSV exportieren");

        // POST /api/v1/member-segments/preview - Preview members matching criteria
        group.MapPost("/preview", PreviewSegmentMembers)
            .WithName("PreviewMemberSegmentMembers")
            .WithDescription("REQ-017: Vorschau der Mitglieder nach Kriterien");

        return app;
    }

    // === Handlers ===

    private static async Task<IResult> GetSegments(
        [AsParameters] GetSegmentsQuery query,
        IMemberSegmentRepository segmentRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var (items, totalCount) = await segmentRepository.GetPagedAsync(
            query.Page,
            query.PageSize,
            query.Search,
            query.IsActive,
            query.SegmentType,
            ct);

        var segmentDtos = new List<MemberSegmentDto>();
        foreach (var segment in items)
        {
            var memberCount = await GetMemberCountForSegment(segment, dbContext, ct);
            segmentDtos.Add(MapToDto(segment, memberCount));
        }

        return Results.Ok(new
        {
            Items = segmentDtos,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)query.PageSize)
        });
    }

    private static async Task<IResult> GetActiveSegments(
        IMemberSegmentRepository segmentRepository,
        CancellationToken ct)
    {
        var segments = await segmentRepository.GetAllActiveAsync(ct);
        return Results.Ok(segments.Select(s => new { s.Id, s.Name, s.SegmentType, s.Color }));
    }

    private static async Task<IResult> CreateSegment(
        [FromBody] CreateSegmentRequest request,
        HttpContext httpContext,
        IMemberSegmentRepository segmentRepository,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        if (await segmentRepository.NameExistsAsync(request.Name, cancellationToken: ct))
            return Results.Conflict(new { Error = "Segmentname bereits vergeben" });

        // Validate criteria JSON if dynamic
        if (request.SegmentType == SegmentType.Dynamic)
        {
            if (string.IsNullOrWhiteSpace(request.CriteriaJson))
                return Results.BadRequest(new { Error = "Dynamische Segmente benötigen Filterkriterien" });

            if (!IsValidCriteriaJson(request.CriteriaJson))
                return Results.BadRequest(new { Error = "Ungültiges Kriterien-JSON" });
        }

        var segment = MemberSegment.Create(
            request.Name,
            request.SegmentType,
            request.Description,
            request.CriteriaJson,
            request.Color);

        await segmentRepository.AddAsync(segment, ct);
        await dbContext.SaveChangesAsync(ct);

        auditLogger.LogAccessGranted(
            httpContext.User,
            "MemberSegment",
            "Create",
            segment.Id.ToString(),
            new Dictionary<string, object> { ["SegmentName"] = request.Name, ["SegmentType"] = request.SegmentType.ToString() });

        return Results.Created($"/api/v1/member-segments/{segment.Id}", MapToDto(segment, 0));
    }

    private static async Task<IResult> GetSegmentById(
        Guid id,
        IMemberSegmentRepository segmentRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        var memberCount = await GetMemberCountForSegment(segment, dbContext, ct);
        return Results.Ok(MapToDto(segment, memberCount));
    }

    private static async Task<IResult> UpdateSegment(
        Guid id,
        [FromBody] UpdateSegmentRequest request,
        HttpContext httpContext,
        IMemberSegmentRepository segmentRepository,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        if (await segmentRepository.NameExistsAsync(request.Name, id, ct))
            return Results.Conflict(new { Error = "Segmentname bereits vergeben" });

        if (segment.SegmentType == SegmentType.Dynamic && !string.IsNullOrWhiteSpace(request.CriteriaJson))
        {
            if (!IsValidCriteriaJson(request.CriteriaJson))
                return Results.BadRequest(new { Error = "Ungültiges Kriterien-JSON" });
        }

        segment.Update(request.Name, request.Description, request.CriteriaJson, request.Color);

        if (request.IsActive.HasValue)
        {
            if (request.IsActive.Value) segment.Activate();
            else segment.Deactivate();
        }

        await dbContext.SaveChangesAsync(ct);

        auditLogger.LogAccessGranted(
            httpContext.User,
            "MemberSegment",
            "Update",
            id.ToString());

        var memberCount = await GetMemberCountForSegment(segment, dbContext, ct);
        return Results.Ok(MapToDto(segment, memberCount));
    }

    private static async Task<IResult> DeleteSegment(
        Guid id,
        HttpContext httpContext,
        IMemberSegmentRepository segmentRepository,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        segment.SoftDelete();
        await dbContext.SaveChangesAsync(ct);

        auditLogger.LogAccessGranted(
            httpContext.User,
            "MemberSegment",
            "Delete",
            id.ToString(),
            new Dictionary<string, object> { ["SegmentName"] = segment.Name });

        return Results.NoContent();
    }

    private static async Task<IResult> GetSegmentMembers(
        Guid id,
        [AsParameters] GetSegmentMembersQuery query,
        IMemberSegmentRepository segmentRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdWithAssignmentsAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        var membersQuery = GetMembersQueryForSegment(segment, dbContext);

        if (!string.IsNullOrWhiteSpace(query.Search))
        {
            var term = query.Search.ToLower();
            membersQuery = membersQuery.Where(m =>
                m.FirstName.ToLower().Contains(term) ||
                m.LastName.ToLower().Contains(term) ||
                m.Email.ToLower().Contains(term));
        }

        var totalCount = await membersQuery.CountAsync(ct);

        var members = await membersQuery
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(m => new SegmentMemberDto
            {
                Id = m.Id,
                FirstName = m.FirstName,
                LastName = m.LastName,
                Email = m.Email,
                Status = m.Status,
                MembershipType = m.MembershipType,
                MemberSince = m.MemberSince
            })
            .ToListAsync(ct);

        return Results.Ok(new
        {
            Items = members,
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)query.PageSize)
        });
    }

    private static async Task<IResult> AddMemberToSegment(
        Guid id,
        [FromBody] AddMemberToSegmentRequest request,
        HttpContext httpContext,
        IMemberSegmentRepository segmentRepository,
        IMemberRepository memberRepository,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdWithAssignmentsAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        if (segment.SegmentType != SegmentType.Static)
            return Results.BadRequest(new { Error = "Mitglieder können nur zu statischen Segmenten hinzugefügt werden" });

        if (!await memberRepository.ExistsAsync(request.MemberId, ct))
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        if (segment.Assignments.Any(a => a.MemberId == request.MemberId))
            return Results.Ok();

        var assignment = MemberSegmentAssignment.Create(segment.Id, request.MemberId);
        dbContext.MemberSegmentAssignments.Add(assignment);
        await dbContext.SaveChangesAsync(ct);

        auditLogger.LogAccessGranted(
            httpContext.User,
            "MemberSegment",
            "AddMember",
            id.ToString(),
            new Dictionary<string, object> { ["MemberId"] = request.MemberId });

        return Results.Ok();
    }

    private static async Task<IResult> RemoveMemberFromSegment(
        Guid id,
        Guid memberId,
        HttpContext httpContext,
        IMemberSegmentRepository segmentRepository,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdWithAssignmentsAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        if (segment.SegmentType != SegmentType.Static)
            return Results.BadRequest(new { Error = "Mitglieder können nur aus statischen Segmenten entfernt werden" });

        var assignment = segment.Assignments.FirstOrDefault(a => a.MemberId == memberId);
        if (assignment != null)
        {
            dbContext.MemberSegmentAssignments.Remove(assignment);
            await dbContext.SaveChangesAsync(ct);
        }

        auditLogger.LogAccessGranted(
            httpContext.User,
            "MemberSegment",
            "RemoveMember",
            id.ToString(),
            new Dictionary<string, object> { ["MemberId"] = memberId });

        return Results.NoContent();
    }

    private static async Task<IResult> ExportSegmentMembers(
        Guid id,
        IMemberSegmentRepository segmentRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var segment = await segmentRepository.GetByIdWithAssignmentsAsync(id, ct);
        if (segment == null)
            return Results.NotFound(new { Error = "Segment nicht gefunden" });

        var membersQuery = GetMembersQueryForSegment(segment, dbContext);

        var members = await membersQuery
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .ToListAsync(ct);

        // CSV export (semicolon-separated, DACH standard)
        var csvLines = new List<string>
        {
            "Vorname;Nachname;E-Mail;Telefon;Status;Mitgliedschaftsart;Mitglied seit"
        };

        foreach (var member in members)
        {
            csvLines.Add($"{EscapeCsv(member.FirstName)};{EscapeCsv(member.LastName)};{EscapeCsv(member.Email)};{EscapeCsv(member.Phone ?? "")};{member.Status};{member.MembershipType};{member.MemberSince:dd/MM/yyyy}");
        }

        var csvContent = string.Join("\n", csvLines);
        var bytes = System.Text.Encoding.UTF8.GetPreamble().Concat(System.Text.Encoding.UTF8.GetBytes(csvContent)).ToArray();
        var fileName = $"segment_{segment.Name.Replace(" ", "_")}_{DateTime.UtcNow:yyyyMMdd}.csv";

        return Results.File(bytes, "text/csv; charset=utf-8", fileName);
    }

    private static async Task<IResult> PreviewSegmentMembers(
        [FromBody] PreviewSegmentRequest request,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.CriteriaJson))
            return Results.BadRequest(new { Error = "Filterkriterien erforderlich" });

        if (!IsValidCriteriaJson(request.CriteriaJson))
            return Results.BadRequest(new { Error = "Ungültiges Kriterien-JSON" });

        var criteria = JsonSerializer.Deserialize<SegmentCriteria>(request.CriteriaJson, JsonOptions);
        if (criteria == null)
            return Results.BadRequest(new { Error = "Ungültiges Kriterien-JSON" });

        var query = ApplyCriteria(dbContext.Members.AsQueryable(), criteria);
        var count = await query.CountAsync(ct);

        var preview = await query
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .Take(20)
            .Select(m => new SegmentMemberDto
            {
                Id = m.Id,
                FirstName = m.FirstName,
                LastName = m.LastName,
                Email = m.Email,
                Status = m.Status,
                MembershipType = m.MembershipType,
                MemberSince = m.MemberSince
            })
            .ToListAsync(ct);

        return Results.Ok(new { TotalCount = count, Preview = preview });
    }

    // === Helpers ===

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    internal static readonly JsonSerializerOptions JsonOptionsInternal = JsonOptions;

    private static async Task<int> GetMemberCountForSegment(
        MemberSegment segment,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var query = GetMembersQueryForSegment(segment, dbContext);
        return await query.CountAsync(ct);
    }

    private static IQueryable<Member> GetMembersQueryForSegment(
        MemberSegment segment,
        ApplicationDbContext dbContext)
    {
        if (segment.SegmentType == SegmentType.Dynamic && !string.IsNullOrWhiteSpace(segment.CriteriaJson))
        {
            var criteria = JsonSerializer.Deserialize<SegmentCriteria>(segment.CriteriaJson, JsonOptions);
            if (criteria != null)
                return ApplyCriteria(dbContext.Members.AsQueryable(), criteria);
        }

        // Static segment: get members via assignments
        var memberIds = segment.Assignments.Select(a => a.MemberId).ToList();
        return dbContext.Members.Where(m => memberIds.Contains(m.Id));
    }

    internal static IQueryable<Member> ApplyCriteria(IQueryable<Member> query, SegmentCriteria criteria)
    {
        if (criteria.Status is { Length: > 0 })
        {
            var statuses = criteria.Status
                .Select(s => Enum.TryParse<DomainMembershipStatus>(s, true, out var v) ? v : (DomainMembershipStatus?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();

            if (statuses.Count > 0)
                query = query.Where(m => statuses.Contains(m.Status));
        }

        if (criteria.Type is { Length: > 0 })
        {
            var types = criteria.Type
                .Select(t => Enum.TryParse<DomainMembershipType>(t, true, out var v) ? v : (DomainMembershipType?)null)
                .Where(v => v.HasValue)
                .Select(v => v!.Value)
                .ToList();

            if (types.Count > 0)
                query = query.Where(m => types.Contains(m.MembershipType));
        }

        if (criteria.MemberSince != null)
        {
            if (criteria.MemberSince.From.HasValue)
                query = query.Where(m => m.MemberSince >= criteria.MemberSince.From.Value);

            if (criteria.MemberSince.To.HasValue)
                query = query.Where(m => m.MemberSince <= criteria.MemberSince.To.Value);
        }

        if (!string.IsNullOrWhiteSpace(criteria.City))
        {
            var city = criteria.City.ToLower();
            query = query.Where(m => m.Address.City.ToLower().Contains(city));
        }

        if (!string.IsNullOrWhiteSpace(criteria.Country))
        {
            var country = criteria.Country.ToLower();
            query = query.Where(m => m.Address.Country.ToLower().Contains(country));
        }

        return query;
    }

    private static bool IsValidCriteriaJson(string json)
    {
        try
        {
            JsonSerializer.Deserialize<SegmentCriteria>(json, JsonOptions);
            return true;
        }
        catch
        {
            return false;
        }
    }

    private static string EscapeCsv(string value)
    {
        if (value.Contains(';') || value.Contains('"') || value.Contains('\n'))
            return $"\"{value.Replace("\"", "\"\"")}\"";
        return value;
    }

    private static MemberSegmentDto MapToDto(MemberSegment segment, int memberCount) => new()
    {
        Id = segment.Id,
        Name = segment.Name,
        Description = segment.Description,
        SegmentType = segment.SegmentType,
        CriteriaJson = segment.CriteriaJson,
        Color = segment.Color,
        IsActive = segment.IsActive,
        MemberCount = memberCount,
        CreatedAt = segment.CreatedAt
    };
}

// === Request/Response DTOs ===

public record GetSegmentsQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    bool? IsActive = null,
    SegmentType? SegmentType = null);

public record GetSegmentMembersQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null);

public record CreateSegmentRequest(
    string Name,
    SegmentType SegmentType,
    string? Description = null,
    string? CriteriaJson = null,
    string? Color = null);

public record UpdateSegmentRequest(
    string Name,
    string? Description = null,
    string? CriteriaJson = null,
    string? Color = null,
    bool? IsActive = null);

public record AddMemberToSegmentRequest(Guid MemberId);

public record PreviewSegmentRequest(string CriteriaJson);

public record MemberSegmentDto
{
    public Guid Id { get; init; }
    public string Name { get; init; } = null!;
    public string? Description { get; init; }
    public SegmentType SegmentType { get; init; }
    public string? CriteriaJson { get; init; }
    public string? Color { get; init; }
    public bool IsActive { get; init; }
    public int MemberCount { get; init; }
    public DateTime CreatedAt { get; init; }
}

public record SegmentMemberDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = null!;
    public string LastName { get; init; } = null!;
    public string Email { get; init; } = null!;
    public DomainMembershipStatus Status { get; init; }
    public DomainMembershipType MembershipType { get; init; }
    public DateOnly MemberSince { get; init; }
}

/// <summary>
/// Segment filter criteria (stored as JSON in CriteriaJson)
/// </summary>
public class SegmentCriteria
{
    public string[]? Status { get; set; }
    public string[]? Type { get; set; }
    public DateRange? MemberSince { get; set; }
    public string? City { get; set; }
    public string? Country { get; set; }
}

public class DateRange
{
    public DateOnly? From { get; set; }
    public DateOnly? To { get; set; }
}
