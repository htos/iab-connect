using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using IabConnect.Api.Authorization;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-030 (E5-S5) AC-1/AC-4/AC-6: self-scoped channel-preference API — GET/PUT for the current
/// user, PUT validation rejects an unknown channel, unauthenticated is 401.
/// </summary>
[Collection("Api")]
public sealed class ChannelPreferenceEndpointTests
{
    private readonly TestWebApplicationFactory _factory;

    public ChannelPreferenceEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    private HttpClient Client(string userId)
    {
        var client = _factory.CreateClient();
        client.DefaultRequestHeaders.Add(TestAuthHandler.UserHeader, userId);
        client.DefaultRequestHeaders.Add(TestAuthHandler.RolesHeader, Roles.Member);
        return client;
    }

    [Fact]
    public async Task Get_WithoutAuth_Returns401()
    {
        var client = _factory.CreateClient();
        var response = await client.GetAsync("/api/v1/privacy/channel-preferences", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Get_ReturnsDefaultEmail_AndAvailableChannels()
    {
        var client = Client("33333333-3333-3333-3333-333333333333");
        var response = await client.GetAsync("/api/v1/privacy/channel-preferences", TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        var body = await response.Content.ReadFromJsonAsync<PreferenceResponse>(TestContext.Current.CancellationToken);
        body.Should().NotBeNull();
        body!.PreferredChannel.Should().Be("Email");
        body.AvailableChannels.Should().Contain(c => c.Channel == "Email" && c.IsEnabled);
        body.AvailableChannels.Should().Contain(c => c.Channel == "Sms" && !c.IsEnabled);
    }

    [Fact]
    public async Task Put_PersistsPreference_AndGetReflectsIt()
    {
        var userId = "44444444-4444-4444-4444-444444444444";
        var client = Client(userId);
        var ct = TestContext.Current.CancellationToken;

        // Email is always enabled — a valid known channel.
        var put = await client.PutAsJsonAsync("/api/v1/privacy/channel-preferences",
            new { preferredChannel = "Email" }, ct);
        put.StatusCode.Should().Be(HttpStatusCode.OK);

        var get = await client.GetAsync("/api/v1/privacy/channel-preferences", ct);
        var body = await get.Content.ReadFromJsonAsync<PreferenceResponse>(ct);
        body!.PreferredChannel.Should().Be("Email");
    }

    [Fact]
    public async Task Put_UnknownChannel_Returns400()
    {
        var client = Client("55555555-5555-5555-5555-555555555555");
        var response = await client.PutAsJsonAsync("/api/v1/privacy/channel-preferences",
            new { preferredChannel = "Telepathy" }, TestContext.Current.CancellationToken);
        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private sealed record PreferenceResponse(string PreferredChannel, List<ChannelAvail> AvailableChannels);
    private sealed record ChannelAvail(string Channel, bool IsEnabled);
}
