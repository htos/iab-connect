using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Blog;
using IabConnect.Domain.Common;
using IabConnect.Domain.Events;
using IabConnect.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-058 (E8-S2): end-to-end tests for the external read API — these also exercise the full S1
/// enforcement chain (ApiKey scheme + Scope policy + Module:api gate + per-credential rate limit).
/// The load-bearing test is AC-2: the projected DTO must omit contact/organizer/PII fields.
/// </summary>
[Collection("Api")]
public sealed class ExternalApiEndpointTests
{
    private readonly TestWebApplicationFactory _factory;
    private readonly TestModuleSettingsService _modules;

    public ExternalApiEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _modules = factory.Services.GetRequiredService<TestModuleSettingsService>();
        _modules.Reset();
    }

    private const string OrganizerSentinel = "SENTINEL_ORGANIZER_NAME";

    /// <summary>Creates a credential via the admin endpoint and returns its one-time secret.</summary>
    private async Task<string> CreateCredentialAsync(params string[] scopes)
    {
        var admin = _factory.CreateClient();
        admin.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, Guid.NewGuid().ToString());
        admin.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, Roles.Admin);

        var resp = await admin.PostAsJsonAsync("/api/v1/admin/api-clients/",
            new { name = "ext-test-" + Guid.NewGuid(), scopes },
            TestContext.Current.CancellationToken);
        resp.StatusCode.Should().Be(HttpStatusCode.Created);
        var created = await resp.Content.ReadFromJsonAsync<CreatedResponse>(TestContext.Current.CancellationToken);
        return created!.Secret;
    }

    private HttpClient ExternalClient(string? secret)
    {
        var client = _factory.CreateClient();
        if (secret is not null)
            client.DefaultRequestHeaders.Add("X-Api-Key", secret);
        return client;
    }

    private async Task<Guid> SeedPublishedEventAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var ev = Event.Create(
            "Public Concert", "A public concert", "Town Hall",
            DateTime.UtcNow.AddDays(1), DateTime.UtcNow.AddDays(2),
            organizerId: Guid.NewGuid(), organizerName: OrganizerSentinel);
        ev.SetVisibility(EventVisibility.Public);
        ev.Publish();
        db.Events.Add(ev);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return ev.Id;
    }

    private async Task<Guid> SeedPublishedBlogAsync()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        var post = BlogPost.Create("Hello World", "Body content", "Summary", "Author Name", "News", null, null, Guid.NewGuid());
        post.Publish(Guid.NewGuid());
        db.BlogPosts.Add(post);
        await db.SaveChangesAsync(TestContext.Current.CancellationToken);
        return post.Id;
    }

    [Fact]
    public async Task Events_WithValidScope_Returns200_AndOmitsSensitiveFields()
    {
        await SeedPublishedEventAsync();
        var secret = await CreateCredentialAsync("events:read");
        var client = ExternalClient(secret);

        var response = await client.GetAsync("/api/v1/external/events", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("Public Concert");
        // AC-2: the whitelist DTO must NOT leak organizer/contact fields.
        raw.Should().NotContain(OrganizerSentinel);
        raw.Should().NotContain("organizerName");
        raw.Should().NotContain("organizerId");
        raw.Should().NotContain("contactEmail");
        raw.Should().NotContain("contactPhone");
    }

    [Fact]
    public async Task Blog_WithValidScope_Returns200()
    {
        await SeedPublishedBlogAsync();
        var secret = await CreateCredentialAsync("blog:read");
        var client = ExternalClient(secret);

        var response = await client.GetAsync("/api/v1/external/blog", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var raw = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        raw.Should().Contain("Hello World");
        raw.Should().NotContain("\"status\"");
    }

    [Fact]
    public async Task NoKey_Returns401()
    {
        var response = await ExternalClient(null)
            .GetAsync("/api/v1/external/events", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task GarbageKey_Returns401()
    {
        var response = await ExternalClient("not-a-valid-key")
            .GetAsync("/api/v1/external/events", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task ValidKey_WrongScope_Returns403()
    {
        var secret = await CreateCredentialAsync("events:read"); // lacks blog:read
        var response = await ExternalClient(secret)
            .GetAsync("/api/v1/external/blog", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task ApiModuleDisabled_Returns403()
    {
        var secret = await CreateCredentialAsync("events:read");
        _modules.SetEnabled(ModuleKeys.Api, false);
        try
        {
            var response = await ExternalClient(secret)
                .GetAsync("/api/v1/external/events", TestContext.Current.CancellationToken);
            response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task EventById_Unpublished_Returns404()
    {
        var secret = await CreateCredentialAsync("events:read");
        var response = await ExternalClient(secret)
            .GetAsync($"/api/v1/external/events/{Guid.NewGuid()}", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task List_ClampsPageSize()
    {
        await SeedPublishedEventAsync();
        var secret = await CreateCredentialAsync("events:read");
        var response = await ExternalClient(secret)
            .GetAsync("/api/v1/external/events?pageSize=500", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        var paged = await response.Content.ReadFromJsonAsync<PagedEnvelope>(TestContext.Current.CancellationToken);
        paged!.PageSize.Should().Be(100); // clamped 1..100
    }

    [Fact]
    public async Task OverLimit_Returns429()
    {
        // Dedicated credential → its own external:{clientId} partition (test limit = 5).
        var secret = await CreateCredentialAsync("events:read");
        var client = ExternalClient(secret);
        var ct = TestContext.Current.CancellationToken;

        HttpStatusCode last = HttpStatusCode.OK;
        for (var i = 0; i < 6; i++)
        {
            var r = await client.GetAsync("/api/v1/external/events", ct);
            last = r.StatusCode;
        }
        last.Should().Be(HttpStatusCode.TooManyRequests, "the 6th request exceeds the per-credential limit of 5");
    }

    private sealed record CreatedResponse(Guid Id, string Name, List<string> Scopes, string Secret, DateTime CreatedAt);
    private sealed record PagedEnvelope(int Page, int PageSize, int TotalCount);
}
