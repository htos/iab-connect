// SPDX-License-Identifier: AGPL-3.0-or-later
namespace IabConnect.Infrastructure.Common;

/// <summary>
/// REQ-089 AC-5 (E20-S3) / ADR-021: AGPL §13 source-disclosure surface.
/// Bound from the <c>Branding</c> configuration section in <c>appsettings.json</c>;
/// the default identifies the canonical upstream repository. White-label forks
/// override at deploy time via the <c>Branding__SourceUrl</c> environment
/// variable (double-underscore for hierarchical key in ASP.NET Core env-var
/// binding). The bound value is projected by the <c>/about</c> endpoint and
/// must remain byte-identical to the <c>NEXT_PUBLIC_SOURCE_URL</c> baked into
/// the frontend image so AGPL §13 disclosure stays self-consistent.
/// </summary>
public sealed class BrandingOptions
{
    public string SourceUrl { get; init; } = "https://github.com/htos/iab-connect";
}
