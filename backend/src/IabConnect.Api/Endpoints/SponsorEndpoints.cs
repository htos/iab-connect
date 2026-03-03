using IabConnect.Application.Sponsors.Commands;
using IabConnect.Domain.Sponsors;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Sponsor management API endpoints
/// REQ-031: Sponsorenverwaltung
/// REQ-033: Vertrags- und Dokumentenverknuepfung
/// </summary>
public static class SponsorEndpoints
{
    public static void MapSponsorEndpoints(this IEndpointRouteBuilder routes)
    {
        // Public endpoint (no auth required) - REQ-048
        var publicGroup = routes.MapGroup("/api/v1/sponsors/public")
            .WithTags("Sponsors");

        publicGroup.MapGet("/", GetPublicSponsors)
            .WithName("GetPublicSponsors")
            .WithSummary("REQ-048: Get active sponsors for public page");

        var group = routes.MapGroup("/api/v1/sponsors")
            .WithTags("Sponsors")
            .RequireAuthorization("RequireVorstand");

        group.MapGet("/", GetAll)
            .WithName("GetSponsors")
            .WithDescription("REQ-031: List all sponsors");

        group.MapGet("/{id:guid}", GetById)
            .WithName("GetSponsorById")
            .WithDescription("REQ-031: Get sponsor by ID");

        group.MapPost("/", Create)
            .WithName("CreateSponsor")
            .WithDescription("REQ-031: Create a new sponsor");

        group.MapPut("/{id:guid}", Update)
            .WithName("UpdateSponsor")
            .WithDescription("REQ-031: Update sponsor");

        group.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteSponsor")
            .WithDescription("REQ-031: Delete sponsor (admin only)");

        group.MapPut("/{id:guid}/status", UpdateStatus)
            .WithName("UpdateSponsorStatus")
            .WithDescription("REQ-031: Change sponsor status");

        // Packages
        group.MapPost("/{id:guid}/packages", AddPackage)
            .WithName("AddSponsorPackage")
            .WithDescription("REQ-031: Add sponsoring package");

        group.MapDelete("/{id:guid}/packages/{packageId:guid}", RemovePackage)
            .WithName("RemoveSponsorPackage")
            .WithDescription("REQ-031: Remove sponsoring package");

        // Contract Links (REQ-033)
        group.MapPost("/{id:guid}/links", AddContractLink)
            .WithName("AddSponsorContractLink")
            .WithDescription("REQ-033: Link document/invoice/event to sponsor");

        group.MapDelete("/{id:guid}/links/{linkId:guid}", RemoveContractLink)
            .WithName("RemoveSponsorContractLink")
            .WithDescription("REQ-033: Remove contract link from sponsor");
    }

    // === Public Endpoint ===

    private static async Task<IResult> GetPublicSponsors(
        ISponsorRepository sponsorRepository,
        CancellationToken ct)
    {
        var sponsors = await sponsorRepository.GetAllAsync(SponsorStatus.Active, ct);
        var dtos = sponsors.Select(s => new PublicSponsorDto(
            s.Id,
            s.CompanyName,
            s.ContactPerson,
            s.Website,
            s.Notes,
            s.Packages.Select(p => new PublicSponsorPackageDto(p.Name, s.Tier.ToString())).ToList()
        )).ToList();
        return Results.Ok(dtos);
    }

    // === Protected Endpoints ===

    private static async Task<IResult> GetAll(
        [FromQuery] string? status,
        ISponsorRepository sponsorRepository,
        CancellationToken ct)
    {
        SponsorStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SponsorStatus>(status, true, out var parsed))
            statusFilter = parsed;

        var sponsors = await sponsorRepository.GetAllAsync(statusFilter, ct);
        var dtos = sponsors.Select(MapToDto).ToList();
        return Results.Ok(dtos);
    }

    private static async Task<IResult> GetById(
        Guid id,
        ISponsorRepository sponsorRepository,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        return Results.Ok(MapToDetailDto(sponsor));
    }

    private static async Task<IResult> Create(
        [FromBody] CreateSponsorRequest request,
        ISender sender,
        ISponsorRepository sponsorRepository,
        CancellationToken ct)
    {
        var command = new CreateSponsorCommand
        {
            CompanyName = request.CompanyName,
            ContactPerson = request.ContactPerson,
            Email = request.Email,
            Phone = request.Phone,
            Website = request.Website,
            Street = request.Street,
            City = request.City,
            PostalCode = request.PostalCode,
            Country = request.Country,
            Tier = request.Tier,
            Notes = request.Notes,
            AgreementStart = request.AgreementStart,
            AgreementEnd = request.AgreementEnd
        };

        var id = await sender.Send(command, ct);
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);

        return Results.Created($"/api/v1/sponsors/{id}", sponsor is not null ? MapToDetailDto(sponsor) : null);
    }

    private static async Task<IResult> Update(
        Guid id,
        [FromBody] UpdateSponsorRequest request,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        if (request.CompanyName != sponsor.CompanyName
            && await sponsorRepository.CompanyNameExistsAsync(request.CompanyName, id, ct))
            return Results.Conflict(new { Error = "A sponsor with this company name already exists" });

        sponsor.Update(
            request.CompanyName,
            request.ContactPerson,
            request.Email,
            request.Phone,
            request.Website,
            request.Street,
            request.City,
            request.PostalCode,
            request.Country,
            request.Tier,
            request.Notes,
            request.AgreementStart,
            request.AgreementEnd);

        await dbContext.SaveChangesAsync(ct);
        return Results.Ok(MapToDetailDto(sponsor));
    }

    private static async Task<IResult> Delete(
        Guid id,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        await sponsorRepository.DeleteAsync(id, ct);
        await dbContext.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateSponsorStatusRequest request,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        switch (request.Status)
        {
            case SponsorStatus.Active: sponsor.Activate(); break;
            case SponsorStatus.Paused: sponsor.Pause(); break;
            case SponsorStatus.Ended: sponsor.End(); break;
            default: return Results.BadRequest(new { Error = "Invalid status" });
        }

        await dbContext.SaveChangesAsync(ct);
        return Results.Ok(MapToDetailDto(sponsor));
    }

    private static async Task<IResult> AddPackage(
        Guid id,
        [FromBody] AddPackageRequest request,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        sponsor.AddPackage(request.Name, request.Description, request.Amount, request.Currency);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDetailDto(sponsor));
    }

    private static async Task<IResult> RemovePackage(
        Guid id,
        Guid packageId,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        sponsor.RemovePackage(packageId);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDetailDto(sponsor));
    }

    private static async Task<IResult> AddContractLink(
        Guid id,
        [FromBody] AddContractLinkRequest request,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        sponsor.AddContractLink(request.LinkType, request.TargetId, request.Description);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDetailDto(sponsor));
    }

    private static async Task<IResult> RemoveContractLink(
        Guid id,
        Guid linkId,
        ISponsorRepository sponsorRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var sponsor = await sponsorRepository.GetByIdAsync(id, ct);
        if (sponsor is null)
            return Results.NotFound(new { Error = "Sponsor not found" });

        sponsor.RemoveContractLink(linkId);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDetailDto(sponsor));
    }

    // === DTOs ===

    private static SponsorListDto MapToDto(Sponsor s) => new(
        s.Id, s.CompanyName, s.ContactPerson, s.Email, s.Phone,
        s.Status, s.Tier, s.AgreementStart, s.AgreementEnd,
        s.Packages.Count, s.ContractLinks.Count);

    private static SponsorDetailDto MapToDetailDto(Sponsor s) => new(
        s.Id, s.CompanyName, s.ContactPerson, s.Email, s.Phone,
        s.Website, s.Street, s.City, s.PostalCode, s.Country,
        s.Status, s.Tier, s.Notes, s.AgreementStart, s.AgreementEnd,
        s.Packages.Select(p => new PackageDto(p.Id, p.Name, p.Description, p.Amount, p.Currency)).ToList(),
        s.ContractLinks.Select(l => new ContractLinkDto(l.Id, l.LinkType, l.TargetId, l.Description, l.CreatedAt)).ToList(),
        s.CreatedAt, s.UpdatedAt);
}

// === Request/Response Records ===

public record CreateSponsorRequest(
    string CompanyName, string? ContactPerson, string? Email, string? Phone,
    string? Website, string? Street, string? City, string? PostalCode, string? Country,
    SponsorTier Tier, string? Notes, DateOnly? AgreementStart, DateOnly? AgreementEnd);

public record UpdateSponsorRequest(
    string CompanyName, string? ContactPerson, string? Email, string? Phone,
    string? Website, string? Street, string? City, string? PostalCode, string? Country,
    SponsorTier Tier, string? Notes, DateOnly? AgreementStart, DateOnly? AgreementEnd);

public record UpdateSponsorStatusRequest(SponsorStatus Status);

public record AddPackageRequest(string Name, string? Description, decimal? Amount, string? Currency);

public record AddContractLinkRequest(ContractLinkType LinkType, Guid TargetId, string? Description);

public record SponsorListDto(
    Guid Id, string CompanyName, string? ContactPerson, string? Email, string? Phone,
    SponsorStatus Status, SponsorTier Tier,
    DateOnly? AgreementStart, DateOnly? AgreementEnd,
    int PackageCount, int LinkCount);

public record SponsorDetailDto(
    Guid Id, string CompanyName, string? ContactPerson, string? Email, string? Phone,
    string? Website, string? Street, string? City, string? PostalCode, string? Country,
    SponsorStatus Status, SponsorTier Tier, string? Notes,
    DateOnly? AgreementStart, DateOnly? AgreementEnd,
    List<PackageDto> Packages, List<ContractLinkDto> ContractLinks,
    DateTime CreatedAt, DateTime? UpdatedAt);

public record PackageDto(Guid Id, string Name, string? Description, decimal? Amount, string? Currency);

public record ContractLinkDto(Guid Id, ContractLinkType LinkType, Guid TargetId, string? Description, DateTime CreatedAt);

// Public DTOs (REQ-048)
public record PublicSponsorDto(
    Guid Id, string CompanyName, string? ContactPerson, string? Website, string? Description,
    List<PublicSponsorPackageDto> Packages);

public record PublicSponsorPackageDto(string Name, string Tier);
