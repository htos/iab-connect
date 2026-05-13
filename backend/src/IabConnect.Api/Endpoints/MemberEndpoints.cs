using IabConnect.Application.Authorization;
using IabConnect.Application.Members.Commands;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Authorization;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using DomainMembershipType = IabConnect.Domain.Members.MembershipType;
using CommandMembershipType = IabConnect.Application.Members.Commands.MembershipType;
using FindMemberDuplicatesQuery = IabConnect.Application.Members.Queries.FindMemberDuplicatesQuery;

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

        // GET /api/v1/members/me/profile-status - Check if profile is complete (REQ-007)
        members.MapGet("/me/profile-status", GetProfileStatus)
            .RequireAuthorization("RequireMember")
            .WithName("GetProfileStatus")
            .WithDescription("REQ-007: Onboarding-Checkliste - Profilstatus prüfen");

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

        // GET /api/v1/members/duplicates - Find duplicate-candidate members (REQ-018)
        members.MapGet("/duplicates", GetMemberDuplicates)
            .RequireAuthorization("RequireVorstand")
            .WithName("GetMemberDuplicates")
            .WithDescription("REQ-018: Dubletten-Kandidaten suchen");

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
        HttpContext httpContext,
        IMemberRepository memberRepository,
        IAuthorizationService authService,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        // REQ-004: Check if user can access this specific member
        var authResult = await authService.CanAccessMemberAsync(
            httpContext.User,
            id,
            Permission.MemberRead,
            memberRepository,
            ct);

        if (!authResult.IsAuthorized)
        {
            auditLogger.LogAccessDenied(
                httpContext.User,
                "Member",
                "Read",
                authResult.DenialReason ?? "Unauthorized",
                id.ToString());
            return Results.Forbid();
        }

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> CreateMember(
        [FromBody] CreateMemberRequest request,
        HttpContext httpContext,
        ISender sender,
        IMemberRepository memberRepository,
        ISecurityAuditLogger auditLogger,
        CancellationToken ct)
    {
        var command = new CreateMemberCommand
        {
            FirstName = request.FirstName,
            LastName = request.LastName,
            Email = request.Email,
            Phone = request.Phone,
            Street = request.Street,
            City = request.City,
            PostalCode = request.PostalCode,
            Country = request.Country ?? "Schweiz",
            MembershipType = (CommandMembershipType)(int)request.MembershipType
        };

        var memberId = await sender.Send(command, ct);

        // REQ-011: Log member creation
        var member = await memberRepository.GetByIdAsync(memberId, ct);
        auditLogger.LogAccessGranted(
            httpContext.User,
            "Member",
            "Create",
            memberId.ToString(),
            new Dictionary<string, object> { ["MemberName"] = $"{request.FirstName} {request.LastName}", ["Email"] = request.Email });

        return Results.Created($"/api/v1/members/{memberId}", member != null ? MapToDto(member) : null);
    }

    private static async Task<IResult> UpdateMember(
        Guid id,
        [FromBody] UpdateMemberRequest request,
        HttpContext httpContext,
        IMemberRepository memberRepository,
        IAuthorizationService authService,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        // REQ-004: Check if user can update this specific member
        var authResult = await authService.CanAccessMemberAsync(
            httpContext.User,
            id,
            Permission.MemberUpdate,
            memberRepository,
            ct);

        if (!authResult.IsAuthorized)
        {
            auditLogger.LogAccessDenied(
                httpContext.User,
                "Member",
                "Update",
                authResult.DenialReason ?? "Unauthorized",
                id.ToString(),
                new Dictionary<string, object> { ["AttemptedChanges"] = request });
            return Results.Forbid();
        }

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

        // Log successful update for audit trail
        auditLogger.LogAccessGranted(
            httpContext.User,
            "Member",
            "Update",
            id.ToString());

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> DeleteMember(
        Guid id,
        HttpContext httpContext,
        IMemberRepository memberRepository,
        IAuthorizationService authService,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        // REQ-004: Delete requires explicit admin permission, not just ownership
        if (!authService.HasPermission(httpContext.User, Permission.MemberDelete))
        {
            auditLogger.LogAccessDenied(
                httpContext.User,
                "Member",
                "Delete",
                "Missing member:delete permission - only admins can delete members",
                id.ToString());
            return Results.Forbid();
        }

        memberRepository.Remove(member);
        await dbContext.SaveChangesAsync(ct);

        // Log deletion for audit
        auditLogger.LogAccessGranted(
            httpContext.User,
            "Member",
            "Delete",
            id.ToString(),
            new Dictionary<string, object>
            {
                ["DeletedMemberEmail"] = member.Email,
                ["DeletedMemberName"] = $"{member.FirstName} {member.LastName}"
            });

        return Results.NoContent();
    }

    private static async Task<IResult> UpdateMemberStatus(
        Guid id,
        [FromBody] UpdateStatusRequest request,
        HttpContext httpContext,
        IMemberRepository memberRepository,
        IAuthorizationService authService,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        // REQ-004: Status change requires specific permission (not just update)
        if (!authService.HasPermission(httpContext.User, Permission.MemberStatusChange))
        {
            auditLogger.LogAccessDenied(
                httpContext.User,
                "Member",
                "StatusChange",
                "Missing member:status:change permission",
                id.ToString(),
                new Dictionary<string, object>
                {
                    ["AttemptedStatus"] = request.Status.ToString(),
                    ["CurrentStatus"] = member.Status.ToString()
                });
            return Results.Forbid();
        }

        var oldStatus = member.Status;
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

        // Log status change
        auditLogger.LogAccessGranted(
            httpContext.User,
            "Member",
            "StatusChange",
            id.ToString(),
            new Dictionary<string, object>
            {
                ["OldStatus"] = oldStatus.ToString(),
                ["NewStatus"] = request.Status.ToString()
            });

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> UpdateMembershipType(
        Guid id,
        [FromBody] UpdateTypeRequest request,
        HttpContext httpContext,
        IMemberRepository memberRepository,
        ISecurityAuditLogger auditLogger,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var member = await memberRepository.GetByIdAsync(id, ct);
        if (member == null)
            return Results.NotFound(new { Error = "Mitglied nicht gefunden" });

        var oldType = member.MembershipType;
        member.ChangeMembershipType(request.MembershipType);
        await dbContext.SaveChangesAsync(ct);

        // REQ-011: Log membership type change
        auditLogger.LogAccessGranted(
            httpContext.User,
            "Member",
            "TypeChange",
            id.ToString(),
            new Dictionary<string, object>
            {
                ["OldType"] = oldType.ToString(),
                ["NewType"] = request.MembershipType.ToString(),
                ["MemberName"] = $"{member.FirstName} {member.LastName}"
            });

        return Results.Ok(MapToDto(member));
    }

    private static async Task<IResult> GetMemberDuplicates(
        [AsParameters] GetMemberDuplicatesRequest request,
        ISender sender,
        CancellationToken ct)
    {
        var query = new FindMemberDuplicatesQuery(
            request.Email,
            request.Phone,
            request.FirstName,
            request.LastName,
            request.PostalCode,
            request.ExcludeMemberId);

        var candidates = await sender.Send(query, ct);
        return Results.Ok(candidates);
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
                RegularMembers = g.Count(m => m.MembershipType == DomainMembershipType.Regular),
                StudentMembers = g.Count(m => m.MembershipType == DomainMembershipType.Student),
                FamilyMembers = g.Count(m => m.MembershipType == DomainMembershipType.Family),
                HonoraryMembers = g.Count(m => m.MembershipType == DomainMembershipType.Honorary)
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

    private static string GetMembershipTypeDisplay(DomainMembershipType type) => type switch
    {
        DomainMembershipType.Regular => "Einzelmitglied",
        DomainMembershipType.Student => "Student/Lernender",
        DomainMembershipType.Family => "Familienmitglied",
        DomainMembershipType.Honorary => "Ehrenmitglied",
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

    /// <summary>
    /// REQ-007: Onboarding - Check profile completion status
    /// Returns a checklist of profile completion items
    /// </summary>
    private static async Task<IResult> GetProfileStatus(
        HttpContext httpContext,
        IMemberRepository memberRepository,
        CancellationToken ct)
    {
        var keycloakUserId = GetKeycloakUserId(httpContext);
        if (keycloakUserId == null)
            return Results.Unauthorized();

        var member = await memberRepository.GetByKeycloakUserIdAsync(keycloakUserId.Value, ct);

        // If no member profile exists yet, return incomplete status
        if (member == null)
        {
            return Results.Ok(new ProfileStatusDto
            {
                IsComplete = false,
                CompletionPercentage = 0,
                HasProfile = false,
                ChecklistItems = new List<ProfileChecklistItem>
                {
                    new() { Key = "profile", Label = "Profil erstellt", IsComplete = false, IsRequired = true },
                    new() { Key = "address", Label = "Adresse angegeben", IsComplete = false, IsRequired = true },
                    new() { Key = "phone", Label = "Telefonnummer angegeben", IsComplete = false, IsRequired = false }
                },
                NextAction = "Bitte vervollständigen Sie Ihr Profil",
                ProfileUrl = "/profile"
            });
        }

        // Check each profile field
        var hasValidAddress = !string.IsNullOrWhiteSpace(member.Address.Street)
            && member.Address.Street != "Nicht angegeben"
            && !string.IsNullOrWhiteSpace(member.Address.City)
            && member.Address.City != "Nicht angegeben"
            && !string.IsNullOrWhiteSpace(member.Address.PostalCode)
            && member.Address.PostalCode != "0000";

        var hasPhone = !string.IsNullOrWhiteSpace(member.Phone);

        var checklistItems = new List<ProfileChecklistItem>
        {
            new() { Key = "profile", Label = "Profil erstellt", IsComplete = true, IsRequired = true },
            new() { Key = "address", Label = "Adresse angegeben", IsComplete = hasValidAddress, IsRequired = true },
            new() { Key = "phone", Label = "Telefonnummer angegeben", IsComplete = hasPhone, IsRequired = false }
        };

        // Calculate completion (required items only for "complete" status)
        var requiredItems = checklistItems.Where(i => i.IsRequired).ToList();
        var completedRequiredItems = requiredItems.Count(i => i.IsComplete);
        var isComplete = completedRequiredItems == requiredItems.Count;

        // Calculate percentage including optional items
        var totalItems = checklistItems.Count;
        var completedItems = checklistItems.Count(i => i.IsComplete);
        var completionPercentage = totalItems > 0 ? (int)Math.Round((completedItems * 100.0) / totalItems) : 0;

        // Determine next action
        string? nextAction = null;
        if (!hasValidAddress)
            nextAction = "Bitte geben Sie Ihre Adresse an";
        else if (!hasPhone)
            nextAction = "Bitte geben Sie Ihre Telefonnummer an (optional)";

        return Results.Ok(new ProfileStatusDto
        {
            IsComplete = isComplete,
            CompletionPercentage = completionPercentage,
            HasProfile = true,
            ChecklistItems = checklistItems,
            NextAction = nextAction,
            ProfileUrl = "/profile"
        });
    }
}

// === Request/Response DTOs ===

public record GetMembersQuery(
    int Page = 1,
    int PageSize = 20,
    string? Search = null,
    MembershipStatus? Status = null,
    DomainMembershipType? Type = null);

/// <summary>
/// REQ-018: Query-string parameters for the duplicate-candidate endpoint.
/// </summary>
public record GetMemberDuplicatesRequest(
    string? Email = null,
    string? Phone = null,
    string? FirstName = null,
    string? LastName = null,
    string? PostalCode = null,
    Guid? ExcludeMemberId = null);

public record CreateMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string Street,
    string City,
    string PostalCode,
    string? Country,
    string? Phone,
    DomainMembershipType MembershipType);

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

public record UpdateTypeRequest(DomainMembershipType MembershipType);

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
    public DomainMembershipType MembershipType { get; init; }
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

/// <summary>
/// REQ-007: Profile status for onboarding checklist
/// </summary>
public record ProfileStatusDto
{
    /// <summary>True if all required profile fields are complete</summary>
    public bool IsComplete { get; init; }

    /// <summary>Percentage of profile completion (0-100)</summary>
    public int CompletionPercentage { get; init; }

    /// <summary>True if member profile exists in database</summary>
    public bool HasProfile { get; init; }

    /// <summary>List of checklist items with completion status</summary>
    public IReadOnlyList<ProfileChecklistItem> ChecklistItems { get; init; } = [];

    /// <summary>Suggested next action for the user (null if complete)</summary>
    public string? NextAction { get; init; }

    /// <summary>URL to the profile page</summary>
    public string ProfileUrl { get; init; } = "/profile";
}

/// <summary>
/// Single checklist item for profile completion
/// </summary>
public record ProfileChecklistItem
{
    /// <summary>Unique key for the checklist item</summary>
    public string Key { get; init; } = null!;

    /// <summary>Display label for the checklist item</summary>
    public string Label { get; init; } = null!;

    /// <summary>True if this item is complete</summary>
    public bool IsComplete { get; init; }

    /// <summary>True if this item is required for profile completion</summary>
    public bool IsRequired { get; init; }
}
