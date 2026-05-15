using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using IabConnect.Domain.Common;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-087 (E10-S5) AC-3: when the <c>public_view</c> module is disabled, the
/// public/anonymous endpoints across modules are gated (403) by the
/// <c>RequireModule</c> endpoint filter — EXCEPT <c>GET /api/v1/settings/public</c>, which
/// must stay reachable so the neutral "site unavailable" page and the frontend shell can
/// still render branding and read the module map.
///
/// Shares <see cref="TestWebApplicationFactory"/> via the <c>Api</c> collection; module
/// state is flipped through the singleton <see cref="TestModuleSettingsService"/> and
/// reset in a finally block.
/// </summary>
[Collection("Api")]
public sealed class ModulePublicViewEndpointTests
{
    private readonly TestWebApplicationFactory _factory;
    private readonly TestModuleSettingsService _modules;

    public ModulePublicViewEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
        _modules = factory.Services.GetRequiredService<TestModuleSettingsService>();
        _modules.Reset();
    }

    public static TheoryData<string> PublicEndpoints() => new()
    {
        "/api/v1/blog/public/",
        "/api/v1/sponsors/public/",
        "/api/v1/events/public",
    };

    [Theory]
    [MemberData(nameof(PublicEndpoints))]
    public async Task PublicEndpoint_Returns403_WhenPublicViewDisabled(string path)
    {
        _modules.SetEnabled(ModuleKeys.PublicView, false);
        try
        {
            var client = _factory.CreateClient(); // anonymous — public surface

            var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
                "the public_view module is disabled, so the public surface must be gated");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Theory]
    [MemberData(nameof(PublicEndpoints))]
    public async Task PublicEndpoint_Reachable_WhenPublicViewEnabled(string path)
    {
        // public_view enabled (ctor reset) — the RequireModule filter must be transparent.
        var client = _factory.CreateClient();

        var response = await client.GetAsync(path, TestContext.Current.CancellationToken);

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task PublicRsvp_Returns403_WhenPublicViewDisabled()
    {
        // Round-2 [Review][Patch] (P-S5-3): the public RSVP endpoint
        // POST /api/v1/events/{eventId}/registrations/public is gated by .RequireModule
        // ("public_view"). It is a POST (not GET like the rest of the public theory data),
        // so it gets its own dedicated fact. We don't care what its happy-path response
        // would be — only that the module gate intercepts before validation reaches the
        // handler.
        _modules.SetEnabled(ModuleKeys.PublicView, false);
        try
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsJsonAsync(
                $"/api/v1/events/{Guid.NewGuid()}/registrations/public",
                new { firstName = "x", lastName = "y", email = "z@example.com" },
                TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
                "public RSVP is a public-site feature gated by public_view");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task PublicContactSubmit_Returns403_WhenPublicViewDisabled()
    {
        // Round-2 [Review][Patch] (P-S5-3): the public contact-form submit endpoint
        // POST /api/v1/public/contact is gated by .RequireModule("public_view"). Same
        // POST-vs-GET reasoning as PublicRsvp_Returns403_WhenPublicViewDisabled.
        _modules.SetEnabled(ModuleKeys.PublicView, false);
        try
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsJsonAsync(
                "/api/v1/public/contact/",
                new { name = "x", email = "z@example.com", message = "hi" },
                TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
                "public contact submission is a public-site feature gated by public_view");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task NewsletterSubscribe_Returns403_WhenPublicViewDisabled()
    {
        // REQ-087 (E10-S5 review patch): newsletter signup is a public-site feature — it
        // must be gated by public_view (the unsubscribe endpoints stay exempt, Q1).
        _modules.SetEnabled(ModuleKeys.PublicView, false);
        try
        {
            var client = _factory.CreateClient();

            var response = await client.PostAsJsonAsync(
                "/api/v1/public/newsletter/subscribe",
                new { email = "someone@example.com" },
                TestContext.Current.CancellationToken);

            response.StatusCode.Should().Be(HttpStatusCode.Forbidden,
                "newsletter signup is a public-site feature gated by public_view");
        }
        finally
        {
            _modules.Reset();
        }
    }

    [Fact]
    public async Task NewsletterSubscribe_NotGated_WhenPublicViewEnabled()
    {
        // public_view enabled (ctor reset) — the RequireModule filter must be transparent.
        var client = _factory.CreateClient();

        var response = await client.PostAsJsonAsync(
            "/api/v1/public/newsletter/subscribe",
            new { email = "someone@example.com" },
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().NotBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task SettingsPublic_StaysReachable_EvenWhenPublicViewDisabled()
    {
        _modules.SetEnabled(ModuleKeys.PublicView, false);
        try
        {
            var client = _factory.CreateClient();

            var response = await client.GetAsync(
                "/api/v1/settings/public", TestContext.Current.CancellationToken);

            // The neutral page + frontend shell + middleware all depend on this endpoint —
            // it must NEVER be gated by public_view (AC-3).
            response.StatusCode.Should().Be(HttpStatusCode.OK);
        }
        finally
        {
            _modules.Reset();
        }
    }
}
