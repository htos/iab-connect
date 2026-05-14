using System.Net;
using FluentAssertions;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-025 (E3.S5) AC-10: runtime API-tier tests for the calendar-feed endpoints. Asserts the
/// live pipeline's authorization posture — the public + per-member feeds are anonymous, the
/// rotate/revoke endpoints require an authenticated member — plus the ICS content-type and
/// cache-header contract.
///
/// Shares <see cref="TestWebApplicationFactory"/> via the <c>Api</c> collection (one factory
/// instance per run; see A15). The in-memory test DB is empty, so the public feed returns an
/// empty-but-valid ICS envelope and the token-bearing lookups 404 — exactly the negative paths
/// AC-10 calls for. Closes the cleanup-sprint <c>calendar-feed-api-tests</c> item (Epic-3-retro
/// §9): the public-feed surface previously had zero automated API-tier coverage.
/// </summary>
[Collection("Api")]
public sealed class EventCalendarFeedEndpointTests
{
    private readonly TestWebApplicationFactory _factory;

    public EventCalendarFeedEndpointTests(TestWebApplicationFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task PublicCalendarFeed_Unauthenticated_Returns200TextCalendar()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/events/calendar.ics", TestContext.Current.CancellationToken);

        // AC-1 / AC-10: the public feed is anonymous — no 401, no token required.
        response.StatusCode.Should().Be(HttpStatusCode.OK);
        response.Content.Headers.ContentType?.MediaType.Should().Be("text/calendar");

        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        body.Should().Contain("BEGIN:VCALENDAR").And.Contain("END:VCALENDAR");
    }

    [Fact]
    public async Task PublicCalendarFeed_SetsPublicCacheHeaders()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/events/calendar.ics", TestContext.Current.CancellationToken);

        response.Headers.CacheControl.Should().NotBeNull();
        response.Headers.CacheControl!.Public.Should().BeTrue();
        response.Headers.CacheControl.MaxAge.Should().Be(TimeSpan.FromSeconds(600));
        response.Headers.Vary.Should().Contain("Accept-Encoding");
    }

    [Fact]
    public async Task MemberCalendarFeed_NoToken_Returns404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/events/my-calendar.ics", TestContext.Current.CancellationToken);

        // Opaque 404 — the per-member feed never reveals whether a token would have matched.
        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task MemberCalendarFeed_UnknownToken_Returns404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/events/my-calendar.ics?token=this-token-does-not-exist",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task SingleEventCalendar_UnknownEvent_Returns404()
    {
        var client = _factory.CreateClient();

        var response = await client.GetAsync(
            $"/api/v1/events/{Guid.NewGuid()}/calendar.ics",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task RotateCalendarToken_Unauthenticated_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.PostAsync(
            "/api/v1/events/calendar/token/rotate", content: null,
            TestContext.Current.CancellationToken);

        // AC-10: rotate requires RequireMember — anonymous callers are rejected by the pipeline.
        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task RevokeCalendarToken_Unauthenticated_Returns401()
    {
        var client = _factory.CreateClient();

        var response = await client.DeleteAsync(
            "/api/v1/events/calendar/token", TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }
}
