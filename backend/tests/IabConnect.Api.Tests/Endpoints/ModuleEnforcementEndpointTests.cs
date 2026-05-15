using System.Net;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Common;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-087 (E10-S3) AC-4/AC-4a/AC-5/AC-6: runtime API-tier tests for backend module
/// enforcement — ADR-008 layer 1. Drives the live authorization pipeline through the
/// <see cref="TestAuthHandler"/> test scheme and flips modules via the singleton
/// <see cref="TestModuleSettingsService"/>:
/// <list type="bullet">
///   <item>a disabled module turns a gated endpoint into 403 + writes a
///     <see cref="AuditEventType.ModuleAccessDenied"/> audit row;</item>
///   <item>an enabled module leaves the endpoint reachable (no 403);</item>
///   <item>never-gated groups (Settings, Module-Settings) and anonymous endpoints stay
///     reachable regardless of module state.</item>
/// </list>
/// Shares <see cref="TestWebApplicationFactory"/> via the <c>Api</c> collection; each test
/// resets module state in a finally block so the shared singleton is left all-enabled.
/// </summary>
[Collection("Api")]
public sealed class ModuleEnforcementEndpointTests
{
    private readonly TestWebApplicationFactory _factory;
    private readonly TestModuleSettingsService _modules;

    public ModuleEnforcementEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _modules = factory.Services.GetRequiredService<TestModuleSettingsService>();
        _modules.Reset();
    }

    // A valid GUID `sub` — some handlers (e.g. GetOwnProfile) parse the subject claim as a
    // Guid, so a non-GUID id would make them 401 on their own, unrelated to module gating.
    private const string TestUserId = "11111111-1111-1111-1111-111111111111";

    private HttpClient CreateAuthenticatedClient(params string[] roles)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, TestUserId);
        if (roles.Length > 0)
        {
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        }
        return client;
    }

    // One representative protected endpoint per module, with a role that satisfies the
    // endpoint's own role policy — so the only thing that can produce a 403 is the module gate.
    //
    // Round-2 [Review][Patch] (DN-4 follow-up): Blog admin (/api/v1/blog/) and Contact
    // admin (/api/v1/contact-messages/) were chained onto Module:communication in
    // round 2, so they belong to the GatedEndpoints surface for theory coverage.
    public static TheoryData<string, string, string> GatedEndpoints() => new()
    {
        { ModuleKeys.Members, "/api/v1/members/", Roles.Vorstand },
        { ModuleKeys.Events, "/api/v1/events/upcoming", Roles.Member },
        { ModuleKeys.Documents, "/api/v1/document-folders/", Roles.Member },
        { ModuleKeys.Communication, "/api/v1/email-templates/", Roles.Vorstand },
        { ModuleKeys.Communication, "/api/v1/blog/", Roles.Vorstand },
        { ModuleKeys.Communication, "/api/v1/contact-messages/", Roles.Vorstand },
        { ModuleKeys.Finance, "/api/v1/finance/accounts/", Roles.Admin },
        { ModuleKeys.Partners, "/api/v1/suppliers/", Roles.Admin },
    };

    [Theory]
    [MemberData(nameof(GatedEndpoints))]
    public async Task DisabledModule_GatedEndpoint_Returns403(string moduleKey, string path, string role)
    {
        _modules.SetEnabled(moduleKey, false);
        try
        {
            var client = CreateAuthenticatedClient(role);

            var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
                "the '{0}' module is disabled, so its route group must deny access", moduleKey);
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Theory]
    [MemberData(nameof(GatedEndpoints))]
    public async Task EnabledModule_GatedEndpoint_NotBlockedByModuleGate(
        string moduleKey, string path, string role)
    {
        // All modules enabled (the ctor reset) — the gate must be transparent (AC-5).
        _ = moduleKey;
        var client = CreateAuthenticatedClient(role);

        var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
        response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task DisabledModule_WritesModuleAccessDeniedAuditEvent()
    {
        _modules.SetEnabled(ModuleKeys.Finance, false);
        try
        {
            var client = CreateAuthenticatedClient(Roles.Admin);

            var response = await client.GetAsync(
                "/api/v1/finance/accounts/", TestContext.Current.CancellationToken);
            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

            // The handler awaits the audit write before returning, so the row is persisted by
            // the time the response completes.
            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var denials = await db.AuditEvents
                .Where(e => e.EventType == AuditEventType.ModuleAccessDenied
                            && e.EntityId == ModuleKeys.Finance)
                .ToListAsync(TestContext.Current.CancellationToken);

            denials.Should().NotBeEmpty("a disabled-module denial must be security-audited (ADR-003)");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Theory]
    [InlineData("/api/v1/module-settings/")]
    [InlineData("/api/v1/settings/")]
    public async Task NeverGatedEndpoints_StayReachable_WithAllModulesDisabled(string path)
    {
        // AC-4a: the admin/settings escape hatches must never be module-gated — otherwise an
        // admin could lock themselves out of re-enabling a module.
        foreach (var key in ModuleKeys.All)
        {
            _modules.SetEnabled(key, false);
        }
        try
        {
            var client = CreateAuthenticatedClient(Roles.Admin);

            var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

            response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
            response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task MyProfileEndpoint_StaysReachable_WhenMembersModuleDisabled()
    {
        // E10-S3 AC-4a / post-review fix: the /me* self-service endpoints ("My Profile") must
        // NOT be gated by the members module — only the member-management sub-group is gated.
        _modules.SetEnabled(ModuleKeys.Members, false);
        try
        {
            var client = CreateAuthenticatedClient(Roles.Member);

            var response = await client.GetAsync(
                "/api/v1/members/me", TestContext.Current.CancellationToken);

            response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden,
                "My Profile is never module-gated, even with the members module disabled");
            response.StatusCode.Should().NotBe(HttpStatusCode.Unauthorized);
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task AlwaysOnAnonymousEndpoints_StayReachable_WithModulesDisabled()
    {
        // E10-S3 left all anonymous endpoints un-gated; E10-S5 then gated the Public View
        // surface (blog/contact/sponsor/event public feeds) — see ModulePublicViewEndpointTests.
        // What remains *always* reachable regardless of module state: GET /settings/public
        // (the exempt branding/module-map source) and the opaque-token calendar feeds (Q4 —
        // left always-on so already-distributed subscription URLs keep working).
        foreach (var key in ModuleKeys.All)
        {
            _modules.SetEnabled(key, false);
        }
        try
        {
            var client = _factory.CreateClient(); // anonymous — no test auth header
            var ct = TestContext.Current.CancellationToken;

            (await client.GetAsync("/api/v1/settings/public", ct)).StatusCode
                .Should().Be(HttpStatusCode.OK);
            (await client.GetAsync("/api/v1/events/calendar.ics", ct)).StatusCode
                .Should().Be(HttpStatusCode.OK);

            // Round-2 [Review][Patch] (P-S5-2): the also-un-gated /my-calendar.ics and
            // /{id}/calendar.ics need their own theory coverage so an accidental
            // re-gating slips through. They take auth/token/ID and may return 401/404
            // (not 200), so the assertion is "not 403" — the proof that the Module gate
            // isn't intercepting them. The other status codes are owned by their own
            // handlers, not by the module-enforcement layer.
            (await client.GetAsync("/api/v1/events/my-calendar.ics", ct)).StatusCode
                .Should().NotBe(HttpStatusCode.Forbidden,
                    "/my-calendar.ics is Q4 always-on, not module-gated");
            (await client.GetAsync(
                $"/api/v1/events/{Guid.NewGuid()}/calendar.ics", ct)).StatusCode
                .Should().NotBe(HttpStatusCode.Forbidden,
                    "/{id}/calendar.ics is Q4 always-on, not module-gated");
        }
        finally
        {
            _modules.Reset();
        }
    }
}
