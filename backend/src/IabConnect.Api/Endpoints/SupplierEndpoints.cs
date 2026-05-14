using IabConnect.Application.Sponsors.Commands;
using IabConnect.Domain.Sponsors;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// Supplier management API endpoints
/// REQ-032: Lieferantenverwaltung
/// REQ-033: Vertrags- und Dokumentenverknuepfung
/// </summary>
public static class SupplierEndpoints
{
    public static void MapSupplierEndpoints(this IEndpointRouteBuilder routes)
    {
        var group = routes.MapGroup("/api/v1/suppliers")
            .WithTags("Suppliers")
            .RequireAuthorization("RequireAdmin")
            .RequireAuthorization("Module:partners"); // REQ-087 (E10-S3): partners module gate

        group.MapGet("/", GetAll)
            .WithName("GetSuppliers")
            .WithDescription("REQ-032: List all suppliers");

        group.MapGet("/{id:guid}", GetById)
            .WithName("GetSupplierById")
            .WithDescription("REQ-032: Get supplier by ID");

        group.MapPost("/", Create)
            .WithName("CreateSupplier")
            .WithDescription("REQ-032: Create a new supplier");

        group.MapPut("/{id:guid}", Update)
            .WithName("UpdateSupplier")
            .WithDescription("REQ-032: Update supplier");

        group.MapDelete("/{id:guid}", Delete)
            .WithName("DeleteSupplier")
            .WithDescription("REQ-032: Delete supplier");

        group.MapPut("/{id:guid}/status", UpdateStatus)
            .WithName("UpdateSupplierStatus")
            .WithDescription("REQ-032: Change supplier status");

        // Contract Links (REQ-033)
        group.MapPost("/{id:guid}/links", AddContractLink)
            .WithName("AddSupplierContractLink")
            .WithDescription("REQ-033: Link document/invoice/event to supplier");

        group.MapDelete("/{id:guid}/links/{linkId:guid}", RemoveContractLink)
            .WithName("RemoveSupplierContractLink")
            .WithDescription("REQ-033: Remove contract link from supplier");
    }

    private static async Task<IResult> GetAll(
        [FromQuery] string? status,
        ISupplierRepository supplierRepository,
        CancellationToken ct)
    {
        SupplierStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<SupplierStatus>(status, true, out var parsed))
            statusFilter = parsed;

        var suppliers = await supplierRepository.GetAllAsync(statusFilter, ct);
        var dtos = suppliers.Select(MapToDto).ToList();
        return Results.Ok(dtos);
    }

    private static async Task<IResult> GetById(
        Guid id,
        ISupplierRepository supplierRepository,
        CancellationToken ct)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, ct);
        if (supplier is null)
            return Results.NotFound(new { Error = "Supplier not found" });

        return Results.Ok(MapToDetailDto(supplier));
    }

    private static async Task<IResult> Create(
        [FromBody] CreateSupplierRequest request,
        ISender sender,
        ISupplierRepository supplierRepository,
        CancellationToken ct)
    {
        var command = new CreateSupplierCommand
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
            Category = request.Category,
            Notes = request.Notes
        };

        var id = await sender.Send(command, ct);
        var supplier = await supplierRepository.GetByIdAsync(id, ct);

        return Results.Created($"/api/v1/suppliers/{id}", supplier is not null ? MapToDetailDto(supplier) : null);
    }

    private static async Task<IResult> Update(
        Guid id,
        [FromBody] UpdateSupplierRequest request,
        ISupplierRepository supplierRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, ct);
        if (supplier is null)
            return Results.NotFound(new { Error = "Supplier not found" });

        if (request.CompanyName != supplier.CompanyName
            && await supplierRepository.CompanyNameExistsAsync(request.CompanyName, id, ct))
            return Results.Conflict(new { Error = "A supplier with this company name already exists" });

        supplier.Update(
            request.CompanyName,
            request.ContactPerson,
            request.Email,
            request.Phone,
            request.Website,
            request.Street,
            request.City,
            request.PostalCode,
            request.Country,
            request.Category,
            request.Notes);

        await dbContext.SaveChangesAsync(ct);
        return Results.Ok(MapToDetailDto(supplier));
    }

    private static async Task<IResult> Delete(
        Guid id,
        ISupplierRepository supplierRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        await supplierRepository.DeleteAsync(id, ct);
        await dbContext.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateStatus(
        Guid id,
        [FromBody] UpdateSupplierStatusRequest request,
        ISupplierRepository supplierRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, ct);
        if (supplier is null)
            return Results.NotFound(new { Error = "Supplier not found" });

        switch (request.Status)
        {
            case SupplierStatus.Active: supplier.Activate(); break;
            case SupplierStatus.Paused: supplier.Pause(); break;
            case SupplierStatus.Ended: supplier.End(); break;
            default: return Results.BadRequest(new { Error = "Invalid status" });
        }

        await dbContext.SaveChangesAsync(ct);
        return Results.Ok(MapToDetailDto(supplier));
    }

    private static async Task<IResult> AddContractLink(
        Guid id,
        [FromBody] AddSupplierContractLinkRequest request,
        ISupplierRepository supplierRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, ct);
        if (supplier is null)
            return Results.NotFound(new { Error = "Supplier not found" });

        supplier.AddContractLink(request.LinkType, request.TargetId, request.Description);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDetailDto(supplier));
    }

    private static async Task<IResult> RemoveContractLink(
        Guid id,
        Guid linkId,
        ISupplierRepository supplierRepository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var supplier = await supplierRepository.GetByIdAsync(id, ct);
        if (supplier is null)
            return Results.NotFound(new { Error = "Supplier not found" });

        supplier.RemoveContractLink(linkId);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDetailDto(supplier));
    }

    // === DTOs ===

    private static SupplierListDto MapToDto(Supplier s) => new(
        s.Id, s.CompanyName, s.ContactPerson, s.Email, s.Phone,
        s.Status, s.Category, s.ContractLinks.Count);

    private static SupplierDetailDto MapToDetailDto(Supplier s) => new(
        s.Id, s.CompanyName, s.ContactPerson, s.Email, s.Phone,
        s.Website, s.Street, s.City, s.PostalCode, s.Country,
        s.Status, s.Category, s.Notes,
        s.ContractLinks.Select(l => new SupplierContractLinkDto(l.Id, l.LinkType, l.TargetId, l.Description, l.CreatedAt)).ToList(),
        s.CreatedAt, s.UpdatedAt);
}

// === Request/Response Records ===

public record CreateSupplierRequest(
    string CompanyName, string? ContactPerson, string? Email, string? Phone,
    string? Website, string? Street, string? City, string? PostalCode, string? Country,
    string? Category, string? Notes);

public record UpdateSupplierRequest(
    string CompanyName, string? ContactPerson, string? Email, string? Phone,
    string? Website, string? Street, string? City, string? PostalCode, string? Country,
    string? Category, string? Notes);

public record UpdateSupplierStatusRequest(SupplierStatus Status);

public record AddSupplierContractLinkRequest(ContractLinkType LinkType, Guid TargetId, string? Description);

public record SupplierListDto(
    Guid Id, string CompanyName, string? ContactPerson, string? Email, string? Phone,
    SupplierStatus Status, string? Category, int LinkCount);

public record SupplierDetailDto(
    Guid Id, string CompanyName, string? ContactPerson, string? Email, string? Phone,
    string? Website, string? Street, string? City, string? PostalCode, string? Country,
    SupplierStatus Status, string? Category, string? Notes,
    List<SupplierContractLinkDto> ContractLinks,
    DateTime CreatedAt, DateTime? UpdatedAt);

public record SupplierContractLinkDto(Guid Id, ContractLinkType LinkType, Guid TargetId, string? Description, DateTime CreatedAt);
