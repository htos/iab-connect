using IabConnect.Application.Common;

namespace IabConnect.Api.Authorization;

/// <summary>
/// REQ-087 (E10-S5): an endpoint filter that returns 403 when its module is disabled.
///
/// <para>E10-S3 gates the authenticated module route groups via the <c>Module:</c>
/// authorization policy. That mechanism cannot reach the public/anonymous endpoints — they
/// carry <see cref="Microsoft.AspNetCore.Authorization.IAllowAnonymous"/> metadata (or no
/// auth at all), and <c>AuthorizationMiddleware</c> short-circuits on <c>IAllowAnonymous</c>
/// before any policy runs. This filter runs in the endpoint-filter pipeline instead, so it
/// works regardless of the auth posture — it is the mechanism E10-S5 uses to gate the
/// Public View surface (public event/blog/contact/sponsor feeds).</para>
/// </summary>
public sealed class ModuleEnabledEndpointFilter : IEndpointFilter
{
    private readonly string _moduleKey;

    public ModuleEnabledEndpointFilter(string moduleKey)
    {
        _moduleKey = moduleKey;
    }

    public async ValueTask<object?> InvokeAsync(
        EndpointFilterInvocationContext context,
        EndpointFilterDelegate next)
    {
        var moduleSettings = context.HttpContext.RequestServices
            .GetRequiredService<IModuleSettingsService>();

        bool enabled;
        try
        {
            enabled = await moduleSettings.IsEnabledAsync(
                _moduleKey, context.HttpContext.RequestAborted);
        }
        catch (Exception ex)
        {
            // REQ-087 (E10-S5 review patch): fail-open on a module-service failure — treat
            // the module as enabled, matching the frontend middleware's degrade-to-enabled
            // behaviour. An unguarded throw here would 500 the entire public surface; a
            // clean 200/403 outcome must never hinge on the cache/DB being reachable. The
            // authenticated ModuleAuthorizationHandler (E10-S3) remains the real control.
            var logger = context.HttpContext.RequestServices
                .GetRequiredService<ILogger<ModuleEnabledEndpointFilter>>();
            logger.LogError(
                ex,
                "Module check for '{ModuleKey}' failed; failing open (treating as enabled).",
                _moduleKey);
            enabled = true;
        }

        if (!enabled)
        {
            return Results.StatusCode(StatusCodes.Status403Forbidden);
        }

        return await next(context);
    }
}

public static class ModuleEndpointFilterExtensions
{
    /// <summary>
    /// REQ-087 (E10-S5): gate an endpoint or route group behind a module — the request 403s
    /// when the module is disabled. Use this for public/anonymous endpoints that the E10-S3
    /// <c>Module:</c> authorization policy cannot reach.
    /// </summary>
    public static TBuilder RequireModule<TBuilder>(this TBuilder builder, string moduleKey)
        where TBuilder : IEndpointConventionBuilder
        => builder.AddEndpointFilter(new ModuleEnabledEndpointFilter(moduleKey));
}
