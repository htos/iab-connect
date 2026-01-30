using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Member management API endpoints
/// REQ-013: Mitgliederstammdaten (CRM mini)
/// REQ-014: Mitgliedschaftsarten & Status
/// REQ-015: Beiträge & Beitragsverwaltung
/// REQ-016: Mitglieder Self-Service Portal
/// </summary>
public static class MemberEndpoints
{
    public static RouteGroupBuilder MapMemberEndpoints(this RouteGroupBuilder group)
    {
        var members = group.MapGroup("/members")
            .WithTags("Members");

        // === Public endpoints (for self-service) ===

        // GET /api/v1/members/me - Get own member profile (REQ-016)
        members.MapGet("/me", GetOwnProfile)
            .RequireAuthorization("RequireMember")
            .WithName("GetOwnMemberProfile")
            .WithDescription("REQ-016: Eigenes Mitgliedsprofil abrufen");

        // PUT /api/v1/members/me - Update own profile (REQ-016)
        members.MapPut("/me", UpdateOwnProfile)
            .RequireAuthorization("RequireMember")
            .WithName("UpdateOwnMemberProfile")
            .WithDescription("REQ-016: Eigenes Profil bearbeiten");

        // === Admin/Vorstand endpoints ===

        // GET /api/v1/members - List all members (REQ-013)
        members.MapGet("/", GetMembers)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetMembers")
            .WithDescription("REQ-013: Mitgliederliste mit Suche und Filterung");

        // GET /api/v1/members/{id} - Get member by ID (REQ-013)
        members.MapGet("/{id:guid}", GetMemberById)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetMemberById")
            .WithDescription("REQ-013: Einzelnes Mitglied abrufen");

        // POST /api/v1/members - Create new member (REQ-014)
        members.MapPost("/", CreateMember)
            .RequireAuthorization("RequireVorstand")
            .WithName("CreateMember")
            .WithDescription("REQ-014: Neues Mitglied anlegen");

        // PUT /api/v1/members/{id} - Update member (REQ-014)
        members.MapPut("/{id:guid}", UpdateMember)
            .RequireAuthorization("RequireVorstand")
            .WithName("UpdateMember")
            .WithDescription("REQ-014: Mitglied bearbeiten");

        // DELETE /api/v1/members/{id} - Delete member (REQ-014)
        members.MapDelete("/{id:guid}", DeleteMember)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteMember")
            .WithDescription("REQ-014: Mitglied löschen (nur Admin)");

        // PUT /api/v1/members/{id}/status - Change membership status (REQ-014)
        members.MapPut("/{id:guid}/status", UpdateMemberStatus)
            .RequireAuthorization("RequireVorstand")
            .WithName("UpdateMemberStatus")
            .WithDescription("REQ-014: Mitgliedsstatus ändern");

        // PUT /api/v1/members/{id}/type - Change membership type (REQ-014)
        members.MapPut("/{id:guid}/type", UpdateMembershipType)
            .RequireAuthorization("RequireVorstand")
            .WithName("UpdateMembershipType")
            .WithDescription("REQ-014: Mitgliedschaftsart ändern");

        // GET /api/v1/members/statistics - Get member statistics (REQ-017)
        members.MapGet("/statistics", GetMemberStatistics)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetMemberStatistics")
            .WithDescription("REQ-017: Mitgliederstatistik");

        return group;
    }

    // === Handlers ===

    private static async Task<IResult> GetOwnProfile(
        HttpContext httpContext,
        IMemberRepository memberRepository,
        CancellationToken ct)
    {
        var keycloakUserId = GetKeycloakUserId(httpContext);
        if (keycloakUserId == null)
            return Results.Unauthorized();

        var member = await memberRepository.GetByKeycloakUserIdAsync(keycloakUserId.Value, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitgliedsprofil nicht gefunden" });

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> UpdateOwnProfile(
        HttpContext httpContext,
        [FromBody] UpdateOwnProfileRequest request,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var keycloakUserId = GetKeycloakUserId(httpContext);
        if (keycloakUserId == null)
            return Results.Unauthorized();

        var member = await memberRepository.GetByKeycloakUserIdAsync(keycloakUserId.Value, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitgliedsprofil nicht gefunden" });

        var address = Address.Create(
            request.Street,
            request.City,
            request.PostalCode,
            request.Country ?? "Schweiz");

        member.Update(
            request.FirstName,
            request.LastName,
            member.Email, // Email cannot be changed by user
            address,
            request.Phone);

        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> GetMembers(
        [AsParameters] GetMembersQuery query,
        IMemberRepository memberRepository,
        CancellationToken ct)
    {
        var (items, totalCount) = await memberRepository.GetPagedAsync(
            query.Page,
            query.PageSize,
            query.Search,
            query.Status,
            query.Type,
            ct);

        var response = new PagedResponse<MemberDto>
        {
            Items = items.Select(MapToDto).ToList(),
            Page = query.Page,
            PageSize = query.PageSize,
            TotalCount = totalCount,
            TotalPages = (int)Math.Ceiling(totalCount / (double)query.PageSize)
        };

        return Results.Ok(response);
    }

    private static async Task<IResult> GetMemberById(
        Guid id,
        IMemberRepository memberRepository,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> CreateMember(
        [FromBody] CreateMemberRequest request,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        // Check for duplicate email
        if (await memberRepository.EmailExistsAsync(request.Email, ct))
            return Results.Conflict(new { Error = "E-Mail-Adresse bereits vergeben" });

        var address = Address.Create(
            request.Street,
            request.City,
            request.PostalCode,
            request.Country ?? "Schweiz");

        var member = Member.Create(
            request.FirstName,
            request.LastName,
            request.Email,
            address,
            request.MembershipType,
            request.Phone);

        await memberRepository.AddAsync(member, ct);
        await dbContext.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/members/{member.Id}", MapToDto(member));
    }

    private static async Task<IResult> UpdateMember(
        Guid id,
        [FromBody] UpdateMemberRequest request,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        // Check for duplicate email if changed
        if (request.Email != member.Email && await memberRepository.EmailExistsAsync(request.Email, ct))
            return Results.Conflict(new { Error = "E-Mail-Adresse bereits vergeben" });

        var address = Address.Create(
            request.Street,
            request.City,
            request.PostalCode,
            request.Country ?? "Schweiz");

        member.Update(
            request.FirstName,
            request.LastName,
            request.Email,
            address,
            request.Phone);

        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> DeleteMember(
        Guid id,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        memberRepository.Remove(member);
        await dbContext.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static async Task<IResult> UpdateMemberStatus(
        Guid id,
        [FromBody] UpdateStatusRequest request,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        switch (request.Status)
        {
            case MembershipStatus.Active:
                member.Activate();
                break;
            case MembershipStatus.Inactive:
                member.Deactivate();
                break;
            case MembershipStatus.Suspended:
                member.Suspend();
                break;
            default:
                return Results.BadRequest(new { Error = "Ungültiger Status" });
        }

        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> UpdateMembershipType(
        Guid id,
        [FromBody] UpdateTypeRequest request,
        IMemberRepository memberRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        member.ChangeMembershipType(request.MembershipType);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> GetMemberStatistics(
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var stats = await dbContext.Members
            .GroupBy(m => 1)
            .Select(g => new MemberStatisticsDto
            {
                TotalMembers = g.Count(),
                ActiveMembers = g.Count(m => m.Status == MembershipStatus.Active),
                PendingMembers = g.Count(m => m.Status == MembershipStatus.Pending),
                InactiveMembers = g.Count(m => m.Status == MembershipStatus.Inactive),
                SuspendedMembers = g.Count(m => m.Status == MembershipStatus.Suspended),
                RegularMembers = g.Count(m => m.MembershipType == MembershipType.Regular),
                StudentMembers = g.Count(m => m.MembershipType == MembershipType.Student),
                FamilyMembers = g.Count(m => m.MembershipType == MembershipType.Family),
                HonoraryMembers = g.Count(m => m.MembershipType == MembershipType.Honorary)
            })
            .FirstOrDefaultAsync(ct);

        return Results.Ok(stats ?? new MemberStatisticsDto());
    }

    // === Helpers ===

    private static Guid? GetKeycloakUserId(HttpContext httpContext)
    {
        var subClaim = httpContext.User.FindFirst("sub")?.Value;
        return Guid.TryParse(subClaim, out var userId) ? userId : null;
    }

    private static MemberDto MapToDto(Member member) => new()
    {
        Id = member.Id,
        FirstName = member.FirstName,
        LastName = member.LastName,
        Email = member.Email,
        Phone = member.Phone,
        Street = member.Address.Street,
        City = member.Address.City,
        PostalCode = member.Address.PostalCode,
        Country = member.Address.Country,
        MembershipType = member.MembershipType,
        MembershipTypeDisplay = GetMembershipTypeDisplay(member.MembershipType),
        Status = member.Status,
        StatusDisplay = GetStatusDisplay(member.Status),
        MemberSince = member.MemberSince
    };

    private static string GetMembershipTypeDisplay(MembershipType type) => type switch
    {
        MembershipType.Regular => "Einzelmitglied",
        MembershipType.Student => "Student/Lernender",
        MembershipType.Family => "Familienmitglied",
        MembershipType.Honorary => "Ehrenmitglied",
        _ => type.ToString()
    };

    private static string GetStatusDisplay(MembershipStatus status) => status switch
    {
        MembershipStatus.Pending => "Ausstehend",
        MembershipStatus.Active => "Aktiv",
        MembershipStatus.Inactive => "Inaktiv",
        MembershipStatus.Suspended => "Gesperrt",
        _ => status.ToString()
    };
}

// === Request/Response DTOs ===

public record GetMembersQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    MembershipStatus? Status = null,
    MembershipType? Type = null);

public record CreateMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string Street,
    string City,
    string PostalCode,
    string? Country,
    string? Phone,
    MembershipType MembershipType);

public record UpdateMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string Street,
    string City,
    string PostalCode,
    string? Country,
    string? Phone);

public record UpdateOwnProfileRequest(
    string FirstName,
    string LastName,
    string Street,
    string City,
    string PostalCode,
    string? Country,
    string? Phone);

public record UpdateStatusRequest(MembershipStatus Status);

public record UpdateTypeRequest(MembershipType MembershipType);

public record MemberDto
{
    public Guid Id { get; init; }
    public string FirstName { get; init; } = null!;
    public string LastName { get; init; } = null!;
    public string Email { get; init; } = null!;
    public string? Phone { get; init; }
    public string Street { get; init; } = null!;
    public string City { get; init; } = null!;
    public string PostalCode { get; init; } = null!;
    public string Country { get; init; } = null!;
    public MembershipType MembershipType { get; init; }
    public string MembershipTypeDisplay { get; init; } = null!;
    public MembershipStatus Status { get; init; }
    public string StatusDisplay { get; init; } = null!;
    public DateOnly MemberSince { get; init; }
}

public record MemberStatisticsDto
{
    public int TotalMembers { get; init; }
    public int ActiveMembers { get; init; }
    public int PendingMembers { get; init; }
    public int InactiveMembers { get; init; }
    public int SuspendedMembers { get; init; }
    public int RegularMembers { get; init; }
    public int StudentMembers { get; init; }
    public int FamilyMembers { get; init; }
    public int HonoraryMembers { get; init; }
}

public record PagedResponse<T>
{
    public IReadOnlyList<T> Items { get; init; } = [];
    public int Page { get; init; }
    public int PageSize { get; init; }
    public int TotalCount { get; init; }
    public int TotalPages { get; init; }
}
