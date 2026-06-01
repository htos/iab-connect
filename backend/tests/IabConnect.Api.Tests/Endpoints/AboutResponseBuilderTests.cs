// SPDX-License-Identifier: AGPL-3.0-or-later
using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Infrastructure.Common;
using Microsoft.Extensions.Configuration;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-089 AC-5 (E20-S3) AC-9: unit tests for the pure configuration→response
/// projection helper <see cref="AboutEndpoints.BuildResponse"/>. Substitutes for
/// the Dockerfile-to-runtime env-var flow at <c>backend/Dockerfile:34-37</c>
/// (E12-S1) without requiring a container build.
///
/// Reaches the <c>internal</c> helper via the <c>[assembly: InternalsVisibleTo]</c>
/// declaration at <c>DependencyInjection.cs:16</c>. No <see cref="TestWebApplicationFactory"/>
/// is needed — the test is pure projection, not pipeline-bound.
/// </summary>
public sealed class AboutResponseBuilderTests
{
    [Fact]
    public void BuildResponse_WithConfiguredOverrides_ProjectsAllFields()
    {
        // Override path: Dockerfile-injected BUILD_SHA / BUILD_DATE present + fork
        // overrides Branding:SourceUrl. Validates the configuration pass-through.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BUILD_SHA"] = "abc1234",
                ["BUILD_DATE"] = "2026-05-15T10:00:00Z",
            })
            .Build();
        var options = new BrandingOptions { SourceUrl = "https://github.com/example/fork" };

        var response = AboutEndpoints.BuildResponse(configuration, options);

        response.Name.Should().Be("IAB Connect");
        response.License.Should().Be("AGPL-3.0-or-later");
        response.CommitSha.Should().Be("abc1234");
        response.BuildDate.Should().Be("2026-05-15T10:00:00Z");
        response.SourceUrl.Should().Be("https://github.com/example/fork");
        response.Version.Should().NotBeNullOrEmpty(
            "the assembly version must always project as a non-empty string (fallback '0.0.0.0')");
    }

    [Fact]
    public void BuildResponse_WithEmptyConfiguration_FallsBackToUnknownAndDefaultSourceUrl()
    {
        // Default path: no BUILD_SHA / BUILD_DATE (local non-Docker `dotnet run`) and
        // no Branding override. Validates the literal "unknown" fallback for the
        // env-var fields and the BrandingOptions default for sourceUrl.
        var configuration = new ConfigurationBuilder().Build();
        var options = new BrandingOptions();

        var response = AboutEndpoints.BuildResponse(configuration, options);

        response.Name.Should().Be("IAB Connect");
        response.License.Should().Be("AGPL-3.0-or-later");
        response.CommitSha.Should().Be("unknown");
        response.BuildDate.Should().Be("unknown");
        response.SourceUrl.Should().Be("https://github.com/htos/iab-connect");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("\t")]
    [InlineData(null)]
    public void BuildResponse_WithNullOrWhitespaceEnvVars_FallsBackToUnknown(string? envValue)
    {
        // ReadOrUnknown contract: null/empty/whitespace → "unknown". A misconfigured
        // env-var (e.g. `BUILD_SHA=` with no value) must NOT propagate empty strings.
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["BUILD_SHA"] = envValue,
                ["BUILD_DATE"] = envValue,
            })
            .Build();

        var response = AboutEndpoints.BuildResponse(configuration, new BrandingOptions());

        response.CommitSha.Should().Be("unknown");
        response.BuildDate.Should().Be("unknown");
    }
}
