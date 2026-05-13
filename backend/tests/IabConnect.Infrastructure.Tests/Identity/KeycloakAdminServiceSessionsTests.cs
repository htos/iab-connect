using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using IabConnect.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Identity;

public sealed class KeycloakAdminServiceSessionsTests
{
    // Lowercase UUIDs matching Keycloak's session/user identifier format.
    private const string User1Id = "11111111-1111-1111-1111-111111111111";
    private const string User2Id = "22222222-2222-2222-2222-222222222222";
    private const string MissingUserId = "99999999-9999-9999-9999-999999999999";
    private const string Session1Id = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    private const string Session2Id = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    [Fact]
    public async Task GetUserSessionsAsync_ReturnsParsedSessions()
    {
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Get
                && path.EndsWith($"/admin/realms/iabconnect/users/{User1Id}/sessions", StringComparison.Ordinal))
            {
                return JsonResponse(new[]
                {
                    new
                    {
                        id = Session1Id,
                        userId = User1Id,
                        username = "user-1@example.com",
                        ipAddress = "10.0.0.1",
                        start = 1_733_600_000_000L,
                        lastAccess = 1_733_600_500_000L,
                        clients = new Dictionary<string, string> { ["client-uuid"] = "iabconnect-frontend" }
                    }
                });
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var sessions = await sut.GetUserSessionsAsync(User1Id, TestContext.Current.CancellationToken);

        sessions.Should().HaveCount(1);
        sessions[0].Id.Should().Be(Session1Id);
        sessions[0].IpAddress.Should().Be("10.0.0.1");
        sessions[0].Start.Should().Be(1_733_600_000_000L);
        sessions[0].LastAccess.Should().Be(1_733_600_500_000L);
        sessions[0].Clients.Should().NotBeNull();
        sessions[0].Clients!.Values.Should().Contain("iabconnect-frontend");
    }

    [Fact]
    public async Task GetUserSessionsAsync_When404_ThrowsKeycloakNotFoundException()
    {
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Get
                && path.EndsWith($"/admin/realms/iabconnect/users/{MissingUserId}/sessions", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var act = () => sut.GetUserSessionsAsync(MissingUserId, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<KeycloakNotFoundException>();
    }

    [Fact]
    public async Task GetUserSessionsAsync_WithMissingMetadata_DegradesGracefully()
    {
        // AC3: Keycloak may omit fields; downstream code must not blow up.
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Get
                && path.EndsWith($"/admin/realms/iabconnect/users/{User2Id}/sessions", StringComparison.Ordinal))
            {
                // Only an id; no ipAddress, no clients, no timestamps.
                return JsonResponse(new[] { new { id = Session2Id } });
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var sessions = await sut.GetUserSessionsAsync(User2Id, TestContext.Current.CancellationToken);

        sessions.Should().HaveCount(1);
        sessions[0].Id.Should().Be(Session2Id);
        sessions[0].IpAddress.Should().BeNull();
        sessions[0].Start.Should().BeNull();
        sessions[0].LastAccess.Should().BeNull();
        sessions[0].Clients.Should().BeNull();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not-a-guid")]
    [InlineData("user-1")]
    [InlineData("../../etc/passwd")]
    public async Task GetUserSessionsAsync_WithNonGuidUserId_ThrowsArgumentException(string invalidUserId)
    {
        // P1: userId must be a valid GUID; reject before issuing any Keycloak request.
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var sut = CreateService(handler);

        var act = () => sut.GetUserSessionsAsync(invalidUserId, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*GUID*");
    }

    private static KeycloakAdminService CreateService(HttpMessageHandler handler)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["KeycloakAdmin:BaseUrl"] = "http://keycloak.test",
                ["KeycloakAdmin:Realm"] = "iabconnect",
                ["KeycloakAdmin:ClientId"] = "iabconnect-admin",
                ["KeycloakAdmin:ClientSecret"] = "secret"
            })
            .Build();

        return new KeycloakAdminService(
            new HttpClient(handler),
            configuration,
            NullLogger<KeycloakAdminService>.Instance);
    }

    private static HttpResponseMessage JsonResponse<T>(T body)
    {
        var json = JsonSerializer.Serialize(body, new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase });
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(json, Encoding.UTF8, "application/json")
        };
    }

    private sealed class RecordingHandler : HttpMessageHandler
    {
        private readonly Func<HttpRequestMessage, HttpResponseMessage> _handler;

        public RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
            => Task.FromResult(_handler(request));
    }
}
