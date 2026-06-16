using System.Net;
using System.Net.Http.Json;
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
/// REQ-028 (E5-S1) AC-6/AC-8: API-tier tests for the automation endpoints. Drives the live
/// authorization pipeline through <see cref="TestAuthHandler"/> and flips
/// <c>Module:communication</c> via the singleton <see cref="TestModuleSettingsService"/>:
/// unauthorized → 403; module-off → 403 + <see cref="AuditEventType.ModuleAccessDenied"/>;
/// authorized create/list/lifecycle happy paths.
/// </summary>
[Collection("Api")]
public sealed class AutomationEndpointTests
{
    private readonly TestWebApplicationFactory _factory;
    private readonly TestModuleSettingsService _modules;

    public AutomationEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _modules = factory.Services.GetRequiredService<TestModuleSettingsService>();
        _modules.Reset();
    }

    private const string TestUserId = "22222222-2222-2222-2222-222222222222";

    private HttpClient Client(params string[] roles)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, TestUserId);
        if (roles.Length > 0)
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return client;
    }

    [Fact]
    public async Task List_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient(); // anonymous
        var response = await client.GetAsync("/api/v1/automations/", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task List_AsNonVorstand_Returns403()
    {
        var client = Client(Roles.Member);
        var response = await client.GetAsync("/api/v1/automations/", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task List_AsVorstand_Returns200()
    {
        var client = Client(Roles.Vorstand);
        var response = await client.GetAsync("/api/v1/automations/", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task List_WithCommunicationModuleDisabled_Returns403_AndAudits()
    {
        _modules.SetEnabled(ModuleKeys.Communication, false);
        try
        {
            var client = Client(Roles.Vorstand);
            var response = await client.GetAsync("/api/v1/automations/", TestContext.Current.CancellationToken);
            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);

            using var scope = _factory.Services.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var denials = await db.AuditEvents
                .Where(e => e.EventType == AuditEventType.ModuleAccessDenied
                            && e.EntityId == ModuleKeys.Communication)
                .ToListAsync(TestContext.Current.CancellationToken);
            denials.Should().NotBeEmpty("a disabled-module denial must be security-audited (ADR-003)");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task Create_ThenLifecycle_HappyPath()
    {
        var client = Client(Roles.Vorstand);
        var ct = TestContext.Current.CancellationToken;

        // Seed an active email template directly so the validator's template check passes.
        int templateId;
        using (var scope = _factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            var template = Domain.Communication.EmailTemplate.Create(
                "Auto Welcome", "Hi", "<p>Welcome</p>", "Welcome", "Onboarding");
            db.EmailTemplates.Add(template);
            await db.SaveChangesAsync(ct);
            templateId = template.Id;
        }

        // Create
        var createResponse = await client.PostAsJsonAsync("/api/v1/automations/", new
        {
            name = "Welcome journey",
            description = "Send a welcome on join",
            templateId,
            triggerType = "MemberJoined",
            offsetDays = (int?)null,
            segmentType = "AllActiveMembers",
            segmentFilter = (string?)null,
            consentFilter = (string?)null
        }, ct);

        createResponse.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await createResponse.Content.ReadFromJsonAsync<AutomationResponse>(ct);
        created.Should().NotBeNull();
        created!.Status.Should().Be("Draft");

        // Activate
        var activateResponse = await client.PostAsync(
            $"/api/v1/automations/{created.Id}/activate", null, ct);
        activateResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var activated = await activateResponse.Content.ReadFromJsonAsync<AutomationResponse>(ct);
        activated!.Status.Should().Be("Active");

        // Pause
        var pauseResponse = await client.PostAsync(
            $"/api/v1/automations/{created.Id}/pause", null, ct);
        pauseResponse.StatusCode.Should().Be(HttpStatusCode.OK);
        var paused = await pauseResponse.Content.ReadFromJsonAsync<AutomationResponse>(ct);
        paused!.Status.Should().Be("Paused");
    }

    [Fact]
    public async Task Create_WithInvalidTemplate_Returns400()
    {
        var client = Client(Roles.Vorstand);
        var ct = TestContext.Current.CancellationToken;

        var response = await client.PostAsJsonAsync("/api/v1/automations/", new
        {
            name = "Bad",
            templateId = 999999, // does not exist
            triggerType = "MemberJoined",
            segmentType = "AllActiveMembers"
        }, ct);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private sealed record AutomationResponse(Guid Id, string Name, string Status);
}
