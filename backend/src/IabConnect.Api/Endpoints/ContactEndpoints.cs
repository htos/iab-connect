using IabConnect.Application.Authorization;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Mvc;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-049: Contact form endpoints
/// Public endpoint for contact form + admin endpoints for managing messages
/// </summary>
public static class ContactEndpoints
{
    public static void MapContactEndpoints(this IEndpointRouteBuilder routes)
    {
        // Public endpoint (no auth)
        var publicGroup = routes.MapGroup("/api/v1/public/contact")
            .WithTags("Contact");

        publicGroup.MapPost("/", SubmitContact)
            .WithName("SubmitContactForm")
            .WithSummary("REQ-049: Submit public contact form");

        // Admin endpoints for managing contact messages
        var adminGroup = routes.MapGroup("/api/v1/contact-messages")
            .WithTags("Contact Messages")
            .RequireAuthorization("RequireVorstand");

        adminGroup.MapGet("/", GetAll)
            .WithName("GetContactMessages")
            .WithSummary("Get all contact messages");

        adminGroup.MapGet("/{id:guid}", GetById)
            .WithName("GetContactMessage")
            .WithSummary("Get contact message by ID");

        adminGroup.MapPost("/{id:guid}/read", MarkAsRead)
            .WithName("MarkContactMessageRead")
            .WithSummary("Mark contact message as read");

        adminGroup.MapPost("/{id:guid}/respond", MarkAsResponded)
            .WithName("MarkContactMessageResponded")
            .WithSummary("Mark contact message as responded");

        adminGroup.MapPost("/{id:guid}/archive", ArchiveMessage)
            .WithName("ArchiveContactMessage")
            .WithSummary("Archive contact message");

        adminGroup.MapDelete("/{id:guid}", Delete)
            .RequireAuthorization("RequireAdmin")
            .WithName("DeleteContactMessage")
            .WithSummary("Delete contact message");
    }

    // === Public ===

    private static async Task<IResult> SubmitContact(
        [FromBody] SubmitContactRequest request,
        IContactMessageRepository repository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        // Honeypot check - if "website" field has value, it's a bot
        if (!string.IsNullOrEmpty(request.Website))
        {
            // Silently pretend success
            return Results.Ok(new { Success = true, Message = "Message received" });
        }

        if (string.IsNullOrWhiteSpace(request.Name) ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Subject) ||
            string.IsNullOrWhiteSpace(request.Message))
        {
            return Results.BadRequest(new { Error = "All fields are required" });
        }

        var message = ContactMessage.Create(request.Name, request.Email, request.Subject, request.Message);
        await repository.AddAsync(message, ct);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(new { Success = true, Message = "Message received" });
    }

    // === Admin ===

    private static async Task<IResult> GetAll(
        [FromQuery] string? status,
        IContactMessageRepository repository,
        CancellationToken ct)
    {
        ContactMessageStatus? statusFilter = null;
        if (!string.IsNullOrEmpty(status) && Enum.TryParse<ContactMessageStatus>(status, true, out var parsed))
            statusFilter = parsed;

        var messages = await repository.GetAllAsync(statusFilter, ct);
        return Results.Ok(messages.Select(MapToDto));
    }

    private static async Task<IResult> GetById(
        Guid id,
        IContactMessageRepository repository,
        CancellationToken ct)
    {
        var msg = await repository.GetByIdAsync(id, ct);
        if (msg == null) return Results.NotFound();
        return Results.Ok(MapToDto(msg));
    }

    private static async Task<IResult> MarkAsRead(
        Guid id,
        HttpContext httpContext,
        IContactMessageRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var msg = await repository.GetByIdAsync(id, ct);
        if (msg == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        msg.MarkAsRead(userId);
        repository.Update(msg);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(msg));
    }

    private static async Task<IResult> MarkAsResponded(
        Guid id,
        [FromBody] RespondRequest? request,
        HttpContext httpContext,
        IContactMessageRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var msg = await repository.GetByIdAsync(id, ct);
        if (msg == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        msg.MarkAsResponded(request?.Notes, userId);
        repository.Update(msg);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(msg));
    }

    private static async Task<IResult> ArchiveMessage(
        Guid id,
        HttpContext httpContext,
        IContactMessageRepository repository,
        IAuthorizationService authService,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var msg = await repository.GetByIdAsync(id, ct);
        if (msg == null) return Results.NotFound();

        var userId = authService.GetCurrentUserId(httpContext.User) ?? Guid.Empty;
        msg.Archive(userId);
        repository.Update(msg);
        await dbContext.SaveChangesAsync(ct);

        return Results.Ok(MapToDto(msg));
    }

    private static async Task<IResult> Delete(
        Guid id,
        IContactMessageRepository repository,
        ApplicationDbContext dbContext,
        CancellationToken ct)
    {
        var msg = await repository.GetByIdAsync(id, ct);
        if (msg == null) return Results.NotFound();

        repository.Remove(msg);
        await dbContext.SaveChangesAsync(ct);

        return Results.NoContent();
    }

    private static ContactMessageDto MapToDto(ContactMessage m) => new(
        m.Id, m.Name, m.Email, m.Subject, m.Message,
        m.Status.ToString(), m.ResponseNotes, m.RespondedAt,
        m.RespondedBy, m.CreatedAt);
}

public sealed record SubmitContactRequest(
    string Name,
    string Email,
    string Subject,
    string Message,
    string? Website = null);

public sealed record RespondRequest(string? Notes);

public sealed record ContactMessageDto(
    Guid Id,
    string Name,
    string Email,
    string Subject,
    string Message,
    string Status,
    string? ResponseNotes,
    DateTime? RespondedAt,
    Guid? RespondedBy,
    DateTime CreatedAt);
