using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-058 (E8-S1) AC-1/2/4: API-tier tests for the admin credential endpoints. Drives the live
/// authorization pipeline via <see cref="TestAuthHandler"/>: anonymous → 401; non-admin → 403; admin
/// create returns the secret exactly once + audits; list never leaks the hash; revoke audits; unknown
/// scope → 400.
/// </summary>
[Collection("Api")]
public sealed class ApiClientEndpointTests
{
    private readonly TestWebApplicationFactory _factory;

    public ApiClientEndpointTests(TestWebApplicationFactory factory) => _factory = factory;

    private const string TestUserId = "33333333-3333-3333-3333-333333333333";

    private HttpClient Client(params string[] roles)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, TestUserId);
        if (roles.Length > 0)
            client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, string.Join(",", roles));
        return client;
    }

    [Fact]
    public async Task List_Anonymous_Returns401()
    {
        var response = await _factory.CreateClient()
            .GetAsync("/api/v1/admin/api-clients/", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task List_NonAdmin_Returns403()
    {
        var response = await Client(Roles.Vorstand)
            .GetAsync("/api/v1/admin/api-clients/", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task Scopes_ReturnsClosedSet()
    {
        var response = await Client(Roles.Admin)
            .GetAsync("/api/v1/admin/api-clients/scopes", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var scopes = await response.Content.ReadFromJsonAsync<List<string>>(TestContext.Current.CancellationToken);
        scopes.Should().Contain(ApiScopes.EventsRead).And.Contain(ApiScopes.BlogRead);
    }

    [Fact]
    public async Task Create_ReturnsSecretOnce_AndAudits()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = Client(Roles.Admin);

        var response = await client.PostAsJsonAsync("/api/v1/admin/api-clients/", new
        {
            name = "Integration Partner",
            scopes = new[] { ApiScopes.EventsRead }
        }, ct);

        response.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await response.Content.ReadFromJsonAsync<CreatedResponse>(ct);
        created.Should().NotBeNull();
        created!.Secret.Should().NotBeNullOrEmpty();
        created.Secret.Should().StartWith("iabc.");
        created.Scopes.Should().Contain(ApiScopes.EventsRead);

        // Audit row written
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var audit = await db.AuditEvents
            .Where(e => e.EventType == AuditEventType.ApiClientCreated && e.EntityId == created.Id.ToString())
            .ToListAsync(ct);
        audit.Should().NotBeEmpty();

        // The stored row holds only a hash — never the raw secret.
        var entity = await db.ApiClients.FirstAsync(c => c.Id == created.Id, ct);
        entity.SecretHash.Should().NotBeNullOrEmpty();
        entity.SecretHash.Should().NotContain(created.Secret);
    }

    [Fact]
    public async Task Create_UnknownScope_Returns400()
    {
        var response = await Client(Roles.Admin).PostAsJsonAsync("/api/v1/admin/api-clients/", new
        {
            name = "Bad",
            scopes = new[] { "members:read" }
        }, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task List_NeverLeaksHashOrSecret()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = Client(Roles.Admin);
        await client.PostAsJsonAsync("/api/v1/admin/api-clients/", new
        {
            name = "Listed Partner",
            scopes = new[] { ApiScopes.BlogRead }
        }, ct);

        var raw = await client.GetStringAsync("/api/v1/admin/api-clients/", ct);
        raw.Should().NotContain("secretHash");
        raw.Should().NotContain("\"secret\"");
    }

    [Fact]
    public async Task Revoke_Returns204_AndAudits()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = Client(Roles.Admin);

        var createResp = await client.PostAsJsonAsync("/api/v1/admin/api-clients/", new
        {
            name = "To Revoke",
            scopes = new[] { ApiScopes.EventsRead }
        }, ct);
        var created = await createResp.Content.ReadFromJsonAsync<CreatedResponse>(ct);

        var revokeResp = await client.PostAsync($"/api/v1/admin/api-clients/{created!.Id}/revoke", null, ct);
        revokeResp.StatusCode.Should().Be(HttpStatusCode.NoContent);

        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var entity = await db.ApiClients.FirstAsync(c => c.Id == created.Id, ct);
        entity.IsRevoked.Should().BeTrue();
        var audit = await db.AuditEvents
            .Where(e => e.EventType == AuditEventType.ApiClientRevoked && e.EntityId == created.Id.ToString())
            .ToListAsync(ct);
        audit.Should().NotBeEmpty();
    }

    [Fact]
    public async Task Revoke_Nonexistent_Returns404()
    {
        var response = await Client(Roles.Admin)
            .PostAsync($"/api/v1/admin/api-clients/{Guid.NewGuid()}/revoke", null, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private sealed record CreatedResponse(Guid Id, string Name, List<string> Scopes, string Secret, DateTime CreatedAt);
}
