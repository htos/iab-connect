// SPDX-License-Identifier: AGPL-3.0-or-later
using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-088 AC-5 (E16-S2): regression guards for the OIDC self-claims endpoint at
/// <c>GET /api/v1/identity/me</c>. Asserts: route exists at the expected path
/// (not <c>/api/v1/me</c>, NOT removed); requires authorization (no bearer → 401);
/// returns <c>UserProfileResponse</c> shape (6 camelCase fields) with roles
/// surfaced from the <c>X-Test-Roles</c> header.
///
/// Shares <see cref="TestWebApplicationFactory"/> via the <c>Api</c> collection.
///
/// Note: the live JWT <c>iss</c>-claim parity check (AC-2) is a runtime-only
/// invariant — verified by Harry's live-Beta browser walkthrough recorded in
/// docs/14_beta_railway_setup.md §18, NOT by these in-process tests.
/// </summary>
[Collection("Api")]
public sealed class IdentityMeRouteShapeTests
{
    private const string EndpointPath = "/api/v1/identity/me";

    private readonly HttpClient _client;

    public IdentityMeRouteShapeTests(TestWebApplicationFactory factory)
    {
        _client = factory.CreateClient();
    }

    [Fact]
    public async Task IdentityMe_WithoutBearer_Returns401()
    {
        // No X-Test-User header → TestAuthHandler returns NoResult → anonymous →
        // [RequireAuthorization] rejects with 401.
        var response = await _client.GetAsync(EndpointPath, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task IdentityMe_IsMappedAtIdentityRouteGroupPath()
    {
        // Regression guard against EndpointMapper.cs:20 being reordered, commented out,
        // or moved out of the /api/v1 prefix. If the route weren't mapped, the response
        // would be 404 (Not Found) — distinct from the 401 the auth gate produces.
        var response = await _client.GetAsync(EndpointPath, TestContext.Current.CancellationToken);

        // 401 means: route resolved + auth gate ran + rejected. 404 means: route not
        // mapped. The discriminator catches the "EndpointMapper drop" failure mode.
        response.StatusCode.Should().NotBe(HttpStatusCode.NotFound,
            "the /api/v1/identity/me route must be mapped — a 404 means the EndpointMapper " +
            "or the IdentityEndpoints route-group was dropped (regression of EndpointMapper.cs:20)");
    }

    [Fact]
    public async Task IdentityMe_WithTestUser_ReturnsSixCamelCaseFields()
    {
        // X-Test-User=<sub> + X-Test-Roles=admin makes TestAuthHandler issue a principal
        // with the "sub" + "preferred_username" claims set to the user-id and a
        // ClaimTypes.Role "admin" claim. IdentityEndpoints.GetCurrentUser projects these
        // into UserProfileResponse.
        using var request = new HttpRequestMessage(HttpMethod.Get, EndpointPath);
        request.Headers.Add(TestAuthHandler.UserHeader, "test-sub-id");
        request.Headers.Add(TestAuthHandler.RolesHeader, "admin");

        var response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("application/json");

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;

        // AC-3 / E16-S2 invariant: 6 camelCase fields — userId, email, name, givenName,
        // familyName, roles. The first 5 are strings; roles is an array.
        foreach (var name in new[] { "userId", "email", "name", "givenName", "familyName" })
        {
            root.TryGetProperty(name, out var element).Should().BeTrue(
                $"the /api/v1/identity/me response must expose the camelCase key '{name}'");
            element.ValueKind.Should().Be(JsonValueKind.String,
                $"the '{name}' field must be a string (got {element.ValueKind})");
        }

        root.TryGetProperty("roles", out var rolesElement).Should().BeTrue(
            "the response must expose the 'roles' array");
        rolesElement.ValueKind.Should().Be(JsonValueKind.Array,
            "'roles' must be a JSON array");
    }

    [Fact]
    public async Task IdentityMe_WithAdminRole_SurfacesAdminInRolesArray()
    {
        // Regression guard against IdentityEndpoints.ExtractRoles regressing to drop the
        // ClaimTypes.Role enumeration (lines 287-292 of IdentityEndpoints.cs). The realm
        // role is the OIDC claim that gates every backend operation per Roles.cs:16; if
        // the projection breaks, every authenticated frontend role-check breaks silently.
        using var request = new HttpRequestMessage(HttpMethod.Get, EndpointPath);
        request.Headers.Add(TestAuthHandler.UserHeader, "test-admin-id");
        request.Headers.Add(TestAuthHandler.RolesHeader, "admin");

        var response = await _client.SendAsync(request, TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var profile = await response.Content.ReadFromJsonAsync<UserProfileResponse>(
            JsonSerializerOptions.Web,
            TestContext.Current.CancellationToken);
        profile.Should().NotBeNull();
        profile!.Roles.Should().Contain("admin");
    }
}
