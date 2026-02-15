using System.Security.Claims;
using System.Text.Json;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Infrastructure.Persistence;
using IUnitOfWork = IabConnect.Infrastructure.Persistence.IUnitOfWork;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for system settings management (REQ-059)
/// </summary>
public static class SettingsEndpoints
{
    public static void MapSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        // Public endpoint - anyone can read app branding (needed for header/logo)
        var publicGroup = routes.MapGroup("/api/v1/settings")
            .WithTags("Settings");

        publicGroup.MapGet("/public", GetPublicSettings)
            .WithName("GetPublicSettings")
            .WithSummary("Get public application settings (branding)")
            .WithDescription("REQ-059: Returns application name and logo settings. No authentication required.")
            .AllowAnonymous();

        // Admin-only endpoints
        var adminGroup = routes.MapGroup("/api/v1/settings")
            .WithTags("Settings")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        adminGroup.MapGet("/", GetSettings)
            .WithName("GetSettings")
            .WithSummary("Get all system settings")
            .WithDescription("REQ-059: Returns all system settings. Admin only.");

        adminGroup.MapPut("/", UpdateSettings)
            .WithName("UpdateSettings")
            .WithSummary("Update system settings")
            .WithDescription("REQ-059: Updates system settings. Changes are audited. Admin only.");
    }

    private static async Task<IResult> GetPublicSettings(
        ISystemSettingsRepository settingsRepository,
        CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);

        return Results.Ok(new PublicSettingsResponse(
            settings.ApplicationName,
            settings.LogoText,
            settings.LogoBackgroundColor,
            settings.LogoTextColor));
    }

    private static async Task<IResult> GetSettings(
        ISystemSettingsRepository settingsRepository,
        CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);

        return Results.Ok(new SettingsResponse(
            settings.Id,
            settings.ApplicationName,
            settings.LogoText,
            settings.LogoBackgroundColor,
            settings.LogoTextColor,
            settings.UpdatedAt,
            settings.UpdatedBy));
    }

    private static async Task<IResult> UpdateSettings(
        UpdateSettingsRequest request,
        ISystemSettingsRepository settingsRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var userId = httpContext.User.FindFirst("sub")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        var userName = httpContext.User.FindFirst("preferred_username")?.Value
            ?? httpContext.User.FindFirst(ClaimTypes.Email)?.Value;

        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);

        // Capture old values for audit
        var oldValues = new
        {
            settings.ApplicationName,
            settings.LogoText,
            settings.LogoBackgroundColor,
            settings.LogoTextColor
        };

        settings.UpdateBranding(
            request.ApplicationName,
            request.LogoText,
            request.LogoBackgroundColor,
            request.LogoTextColor,
            userName);

        settingsRepository.Update(settings);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Audit the change (REQ-059: Änderungen sind auditiert)
        var changes = JsonSerializer.Serialize(new
        {
            OldValues = oldValues,
            NewValues = new
            {
                request.ApplicationName,
                request.LogoText,
                request.LogoBackgroundColor,
                request.LogoTextColor
            }
        });

        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            "System settings updated",
            entityType: "SystemSettings",
            entityId: settings.Id.ToString(),
            details: changes,
            ct: cancellationToken);

        return Results.Ok(new SettingsResponse(
            settings.Id,
            settings.ApplicationName,
            settings.LogoText,
            settings.LogoBackgroundColor,
            settings.LogoTextColor,
            settings.UpdatedAt,
            settings.UpdatedBy));
    }

    // DTOs
    public sealed record PublicSettingsResponse(
        string ApplicationName,
        string LogoText,
        string LogoBackgroundColor,
        string LogoTextColor);

    public sealed record SettingsResponse(
        Guid Id,
        string ApplicationName,
        string LogoText,
        string LogoBackgroundColor,
        string LogoTextColor,
        DateTime UpdatedAt,
        string? UpdatedBy);

    public sealed record UpdateSettingsRequest(
        string ApplicationName,
        string LogoText,
        string LogoBackgroundColor,
        string LogoTextColor);
}
