using System.Text.Json;
using IabConnect.Api.Extensions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Infrastructure.Persistence;
using IUnitOfWork = IabConnect.Infrastructure.Persistence.IUnitOfWork;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for system settings management (REQ-059).
/// REQ-086 (E9-S1): extended with organization-profile fields and a logo
/// upload/passthrough pair so the platform identity is admin-configurable.
/// </summary>
public static class SettingsEndpoints
{
    /// <summary>Relative path of the public logo passthrough endpoint.</summary>
    private const string LogoUrlPath = "/api/v1/settings/logo";

    /// <summary>Max accepted logo upload size — 1 MB (REQ-086 AC-6).</summary>
    private const long MaxLogoSizeBytes = 1 * 1024 * 1024;

    /// <summary>Allowed logo content types (REQ-086 AC-6).</summary>
    private static readonly HashSet<string> AllowedLogoContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png",
        "image/jpeg",
        "image/svg+xml",
        "image/webp",
    };

    public static void MapSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        // Public endpoint - anyone can read app branding (needed for header/logo)
        var publicGroup = routes.MapGroup("/api/v1/settings")
            .WithTags("Settings");

        publicGroup.MapGet("/public", GetPublicSettings)
            .WithName("GetPublicSettings")
            .WithSummary("Get public application settings (branding)")
            .WithDescription("REQ-059 / REQ-086: Returns non-sensitive branding settings. No authentication required.")
            .AllowAnonymous();

        publicGroup.MapGet("/logo", GetLogo)
            .WithName("GetSettingsLogo")
            .WithSummary("Get the organization logo asset")
            .WithDescription("REQ-086: Streams the current organization logo, or 404 when none is configured. No authentication required.")
            .AllowAnonymous();

        // Admin-only endpoints
        var adminGroup = routes.MapGroup("/api/v1/settings")
            .WithTags("Settings")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        adminGroup.MapGet("/", GetSettings)
            .WithName("GetSettings")
            .WithSummary("Get all system settings")
            .WithDescription("REQ-059 / REQ-086: Returns all system settings. Admin only.");

        adminGroup.MapPut("/", UpdateSettings)
            .WithName("UpdateSettings")
            .WithSummary("Update system settings")
            .WithDescription("REQ-059 / REQ-086: Updates branding + organization profile. Changes are audited. Admin only.");

        adminGroup.MapPost("/logo", UploadLogo)
            .WithName("UploadSettingsLogo")
            .WithSummary("Upload the organization logo")
            .WithDescription("REQ-086: Uploads the organization logo (png/jpeg/svg/webp, max 1 MB). Audited. Admin only.")
            .DisableAntiforgery();
    }

    private static async Task<IResult> GetPublicSettings(
        ISystemSettingsRepository settingsRepository,
        CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);

        // REQ-086 AC-5: non-sensitive subset only — contact email/phone/address are
        // NOT exposed anonymously.
        return Results.Ok(new PublicSettingsResponse(
            settings.ApplicationName,
            settings.LogoText,
            settings.LogoBackgroundColor,
            settings.LogoTextColor,
            settings.Description,
            settings.PrimaryColor,
            settings.PublicSiteEnabled,
            settings.LogoAssetKey is null ? null : LogoUrlPath));
    }

    private static async Task<IResult> GetSettings(
        ISystemSettingsRepository settingsRepository,
        CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);

        return Results.Ok(ToSettingsResponse(settings));
    }

    private static async Task<IResult> UpdateSettings(
        UpdateSettingsRequest request,
        ISystemSettingsRepository settingsRepository,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var userName = httpContext.GetUserName();

        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);

        // Capture old values for audit
        var oldValues = new
        {
            settings.ApplicationName,
            settings.LogoText,
            settings.LogoBackgroundColor,
            settings.LogoTextColor,
            settings.Description,
            settings.ContactEmail,
            settings.ContactPhone,
            settings.ContactAddress,
            settings.PrimaryColor,
            settings.PublicSiteEnabled,
        };

        try
        {
            settings.UpdateBranding(
                request.ApplicationName,
                request.LogoText,
                request.LogoBackgroundColor,
                request.LogoTextColor,
                userName);

            settings.UpdateOrganizationProfile(
                request.Description,
                request.ContactEmail,
                request.ContactPhone,
                request.ContactAddress,
                request.PrimaryColor,
                request.PublicSiteEnabled,
                userName);
        }
        catch (ArgumentException ex)
        {
            return Results.BadRequest(new { Message = ex.Message });
        }

        settingsRepository.Update(settings);
        await unitOfWork.SaveChangesAsync(cancellationToken);

        // Audit the change (REQ-059 / REQ-086: changes are audited)
        var changes = JsonSerializer.Serialize(new
        {
            OldValues = oldValues,
            NewValues = new
            {
                settings.ApplicationName,
                settings.LogoText,
                settings.LogoBackgroundColor,
                settings.LogoTextColor,
                settings.Description,
                settings.ContactEmail,
                settings.ContactPhone,
                settings.ContactAddress,
                settings.PrimaryColor,
                settings.PublicSiteEnabled,
            }
        });

        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            "System settings updated",
            entityType: "SystemSettings",
            entityId: settings.Id.ToString(),
            details: changes,
            ct: cancellationToken);

        return Results.Ok(ToSettingsResponse(settings));
    }

    private static async Task<IResult> UploadLogo(
        IFormFile? file,
        ISystemSettingsRepository settingsRepository,
        IDocumentStorage documentStorage,
        IUnitOfWork unitOfWork,
        IAuditService auditService,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        if (file is null || file.Length == 0)
            return Results.BadRequest(new { Message = "No logo file provided." });

        if (file.Length > MaxLogoSizeBytes)
            return Results.BadRequest(new { Message = "Logo file is too large (max 1 MB)." });

        if (!AllowedLogoContentTypes.Contains(file.ContentType))
            return Results.BadRequest(new { Message = "Unsupported logo file type. Allowed: PNG, JPEG, SVG, WebP." });

        // Review hardening (REQ-086): the multipart Content-Type header is client-controlled,
        // so verify the actual bytes match the declared type before trusting it.
        if (!await ContentMatchesDeclaredTypeAsync(file, cancellationToken))
            return Results.BadRequest(new { Message = "Logo file content does not match its declared type." });

        var userName = httpContext.GetUserName();
        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);
        var oldKey = settings.LogoAssetKey;

        var newKey = $"branding/logo-{Guid.NewGuid():N}";
        await using (var stream = file.OpenReadStream())
        {
            await documentStorage.UploadAsync(newKey, stream, file.ContentType, cancellationToken);
        }

        settings.SetLogoAssetKey(newKey, userName);
        settingsRepository.Update(settings);
        try
        {
            await unitOfWork.SaveChangesAsync(cancellationToken);
        }
        catch
        {
            // Review hardening (REQ-086): the asset was uploaded but the key never persisted —
            // remove the orphan before surfacing the failure to the caller.
            try
            {
                await documentStorage.DeleteAsync(newKey, cancellationToken);
            }
            catch (Exception)
            {
                // Best-effort — an orphaned asset is preferable to masking the original error.
            }

            throw;
        }

        // Best-effort cleanup of the superseded asset — never fail the request on this.
        if (!string.IsNullOrWhiteSpace(oldKey))
        {
            try
            {
                await documentStorage.DeleteAsync(oldKey, cancellationToken);
            }
            catch (Exception)
            {
                // Orphaned asset is acceptable; the new logo is already persisted. Catch broadly
                // so a non-S3 IDocumentStorage backend cannot fault an already-committed request.
            }
        }

        var changes = JsonSerializer.Serialize(new
        {
            OldValues = new { LogoAssetKey = oldKey },
            NewValues = new { LogoAssetKey = newKey },
        });

        await auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            "Organization logo updated",
            entityType: "SystemSettings",
            entityId: settings.Id.ToString(),
            details: changes,
            ct: cancellationToken);

        return Results.Ok(new LogoUploadResponse(LogoUrlPath));
    }

    private static async Task<IResult> GetLogo(
        ISystemSettingsRepository settingsRepository,
        IDocumentStorage documentStorage,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        var settings = await settingsRepository.GetSettingsAsync(cancellationToken);
        if (string.IsNullOrWhiteSpace(settings.LogoAssetKey))
            return Results.NotFound();

        // The asset key is a fresh GUID on every upload, so it is a stable, content-addressable
        // ETag — a changed logo always changes the key. Lets the browser skip re-downloading on
        // every public page render.
        var etag = $"\"{settings.LogoAssetKey}\"";
        if (httpContext.Request.Headers.IfNoneMatch == etag)
            return Results.StatusCode(StatusCodes.Status304NotModified);

        try
        {
            var info = await documentStorage.GetFileInfoAsync(settings.LogoAssetKey, cancellationToken);
            if (info is null)
                return Results.NotFound();

            var stream = await documentStorage.DownloadAsync(settings.LogoAssetKey, cancellationToken);

            // Review hardening (REQ-086): this passthrough is anonymous and may serve an
            // admin-uploaded SVG. A locked-down CSP + nosniff neutralizes script execution on
            // direct navigation while <img>-based rendering (the only way the frontend uses
            // this URL) is unaffected. Caching headers keep the hot public path cheap.
            var headers = httpContext.Response.Headers;
            headers.ContentSecurityPolicy = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
            headers.XContentTypeOptions = "nosniff";
            headers.CacheControl = "public, max-age=300";
            headers.ETag = etag;

            // Passthrough (not a pre-signed URL) so the logo has a stable, non-expiring
            // URL for every page render. Streamed with the stored content type.
            return Results.File(stream, info.ContentType);
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception)
        {
            // Any storage failure (TOCTOU delete between info-check and download, a non-S3
            // backend error, a transient outage) on a best-effort public passthrough degrades
            // to 404 rather than a 500.
            return Results.NotFound();
        }
    }

    /// <summary>
    /// Review hardening (REQ-086): verifies the uploaded file's leading bytes match its declared
    /// <see cref="IFormFile.ContentType"/> — the multipart header alone is client-controlled and
    /// must not be trusted.
    /// </summary>
    private static async Task<bool> ContentMatchesDeclaredTypeAsync(IFormFile file, CancellationToken cancellationToken)
    {
        var header = new byte[512];
        int read;
        await using (var stream = file.OpenReadStream())
        {
            read = await stream.ReadAsync(header, cancellationToken);
        }

        var bytes = header.AsSpan(0, read);
        return file.ContentType.ToLowerInvariant() switch
        {
            "image/png" => bytes.StartsWith(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
            "image/jpeg" => bytes.StartsWith(new byte[] { 0xFF, 0xD8, 0xFF }),
            "image/webp" => read >= 12
                && bytes[..4].SequenceEqual("RIFF"u8)
                && bytes[8..12].SequenceEqual("WEBP"u8),
            "image/svg+xml" => LooksLikeSvg(bytes),
            _ => false,
        };
    }

    private static bool LooksLikeSvg(ReadOnlySpan<byte> bytes)
    {
        // SVG is text; skip a UTF-8 BOM + leading whitespace, then expect an XML/SVG opener.
        var text = System.Text.Encoding.UTF8.GetString(bytes).TrimStart('﻿', ' ', '\t', '\r', '\n');
        return text.StartsWith("<?xml", StringComparison.OrdinalIgnoreCase)
            || text.StartsWith("<svg", StringComparison.OrdinalIgnoreCase)
            || text.StartsWith("<!--", StringComparison.Ordinal);
    }

    private static SettingsResponse ToSettingsResponse(Domain.Common.SystemSettings settings) => new(
        settings.Id,
        settings.ApplicationName,
        settings.LogoText,
        settings.LogoBackgroundColor,
        settings.LogoTextColor,
        settings.Description,
        settings.ContactEmail,
        settings.ContactPhone,
        settings.ContactAddress,
        settings.PrimaryColor,
        settings.PublicSiteEnabled,
        settings.LogoAssetKey is null ? null : LogoUrlPath,
        settings.UpdatedAt,
        settings.UpdatedBy);

    // DTOs
    public sealed record PublicSettingsResponse(
        string ApplicationName,
        string LogoText,
        string LogoBackgroundColor,
        string LogoTextColor,
        string? Description,
        string? PrimaryColor,
        bool? PublicSiteEnabled,
        string? LogoUrl);

    public sealed record SettingsResponse(
        Guid Id,
        string ApplicationName,
        string LogoText,
        string LogoBackgroundColor,
        string LogoTextColor,
        string? Description,
        string? ContactEmail,
        string? ContactPhone,
        string? ContactAddress,
        string? PrimaryColor,
        bool? PublicSiteEnabled,
        string? LogoUrl,
        DateTime UpdatedAt,
        string? UpdatedBy);

    public sealed record UpdateSettingsRequest(
        string ApplicationName,
        string LogoText,
        string LogoBackgroundColor,
        string LogoTextColor,
        string? Description,
        string? ContactEmail,
        string? ContactPhone,
        string? ContactAddress,
        string? PrimaryColor,
        bool? PublicSiteEnabled);

    public sealed record LogoUploadResponse(string LogoUrl);
}
