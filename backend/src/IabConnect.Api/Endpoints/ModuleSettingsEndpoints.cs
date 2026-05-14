using IabConnect.Api.Extensions;
using IabConnect.Application.ModuleSettings.Commands;
using IabConnect.Application.ModuleSettings.Queries;
using MediatR;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// API endpoints for module enablement configuration (REQ-087, Epic E10-S2).
///
/// <para><b>Self-lockout guard (AC-6):</b> this admin-only group is deliberately
/// <b>never</b> <c>Module:</c>-gated — E10-S3 introduces module enforcement but must skip
/// this group and <c>/api/v1/settings*</c>, so an admin can always reach the Modules tab
/// to re-enable a module. There is no "admin" module key, so the API cannot be used to
/// gate itself.</para>
/// </summary>
public static class ModuleSettingsEndpoints
{
    public static void MapModuleSettingsEndpoints(this IEndpointRouteBuilder routes)
    {
        // Admin-only — mirrors the SettingsEndpoints admin group.
        var adminGroup = routes.MapGroup("/api/v1/module-settings")
            .WithTags("ModuleSettings")
            .RequireAuthorization(policy => policy.RequireRole("admin"));

        adminGroup.MapGet("/", GetModuleSettings)
            .WithName("GetModuleSettings")
            .WithSummary("Get all module settings")
            .WithDescription("REQ-087: Returns every module's enablement state with last-changed metadata. Admin only.");

        adminGroup.MapPut("/{moduleKey}", UpdateModuleSetting)
            .WithName("UpdateModuleSetting")
            .WithSummary("Enable or disable a module")
            .WithDescription("REQ-087: Updates one module's enabled flag. Change is audited. Admin only.");
    }

    private static async Task<IResult> GetModuleSettings(
        ISender sender,
        CancellationToken cancellationToken)
    {
        var result = await sender.Send(new GetModuleSettingsQuery(), cancellationToken);
        return Results.Ok(result);
    }

    private static async Task<IResult> UpdateModuleSetting(
        string moduleKey,
        UpdateModuleSettingRequest request,
        ISender sender,
        HttpContext httpContext,
        CancellationToken cancellationToken)
    {
        // Validation (unknown key) and not-found bubble to ExceptionHandlingMiddleware
        // as 400 / 404 respectively.
        var result = await sender.Send(
            new UpdateModuleSettingCommand(moduleKey, request.Enabled, httpContext.GetUserName()),
            cancellationToken);
        return Results.Ok(result);
    }

    public sealed record UpdateModuleSettingRequest(bool Enabled);
}
