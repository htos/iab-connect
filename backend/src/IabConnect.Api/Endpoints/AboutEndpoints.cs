// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Reflection;
using IabConnect.Infrastructure.Common;
using Microsoft.Extensions.Options;

namespace IabConnect.Api.Endpoints;

/// <summary>
/// REQ-089 AC-5 (E20-S3) / ADR-021: source-disclosure endpoint for AGPL §13 compliance.
/// Registered at the application root (NOT under <c>/api/v1</c>) parallel to <c>/health</c>
/// so the disclosure surface survives API version cuts. The handler is unauthenticated
/// and projects six fields:
/// <list type="bullet">
///   <item><c>name</c>: hard-coded upstream identifier — NOT read from <c>SystemSettings.ApplicationName</c>
///   (admin-editable per REQ-086) so the AGPL §13 disclosure always identifies the upstream
///   project, not the white-label deployer.</item>
///   <item><c>license</c>: hard-coded SPDX identifier byte-identical to the
///   <c>org.opencontainers.image.licenses</c> OCI label set by the backend Dockerfile
///   (E12-S1) and to the LICENSE / COPYRIGHT files (E20-S1).</item>
///   <item><c>version</c>: assembly version (currently <c>1.0.0.0</c> default; awaits
///   future SemVer-stamping story).</item>
///   <item><c>commitSha</c>: <c>BUILD_SHA</c> env var injected by the Dockerfile build-arg
///   chain at <c>backend/Dockerfile:34-37</c>; falls back to <c>"unknown"</c> for local
///   non-Docker <c>dotnet run</c>.</item>
///   <item><c>buildDate</c>: <c>BUILD_DATE</c> env var, same fallback. Expected ISO-8601 UTC
///   when set by E20-S5 CI (<c>${{ github.event.head_commit.timestamp }}</c>).</item>
///   <item><c>sourceUrl</c>: bound from <c>Branding:SourceUrl</c> via
///   <see cref="BrandingOptions"/>; default points to the canonical upstream repo. Forks
///   override at deploy time via <c>Branding__SourceUrl</c>.</item>
/// </list>
/// </summary>
public static class AboutEndpoints
{
    public static void MapAboutEndpoints(this IEndpointRouteBuilder routes)
    {
        routes.MapGet("/about", GetAbout)
            .WithName("GetAbout")
            .WithTags("About")
            .WithSummary("Source-disclosure endpoint (AGPL §13)")
            .WithDescription("REQ-089 AC-5: returns name, license, version, commitSha, buildDate, sourceUrl. Unauthenticated. ADR-021.")
            .Produces<AboutResponse>(StatusCodes.Status200OK)
            .AllowAnonymous();
    }

    private static IResult GetAbout(
        IConfiguration configuration,
        IOptions<BrandingOptions> brandingOptions)
        => Results.Ok(BuildResponse(configuration, brandingOptions.Value));

    /// <summary>
    /// Pure projection helper. Internal so the configuration-binding unit test in
    /// <c>IabConnect.Api.Tests</c> can exercise it via the existing
    /// <c>[assembly: InternalsVisibleTo("IabConnect.Api.Tests")]</c> at
    /// <c>DependencyInjection.cs:16</c> without standing up a
    /// <c>TestWebApplicationFactory</c>.
    /// </summary>
    internal static AboutResponse BuildResponse(
        IConfiguration configuration,
        BrandingOptions options) =>
        new(
            Name: "IAB Connect",
            License: "AGPL-3.0-or-later",
            Version: Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "0.0.0.0",
            CommitSha: ReadOrUnknown(configuration["BUILD_SHA"]),
            BuildDate: ReadOrUnknown(configuration["BUILD_DATE"]),
            SourceUrl: options.SourceUrl);

    private static string ReadOrUnknown(string? value) =>
        string.IsNullOrWhiteSpace(value) ? "unknown" : value;

    public sealed record AboutResponse(
        string Name,
        string License,
        string Version,
        string CommitSha,
        string BuildDate,
        string SourceUrl);
}
