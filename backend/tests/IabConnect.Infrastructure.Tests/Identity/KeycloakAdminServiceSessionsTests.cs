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
                && path.EndsWith("/admin/realms/iabconnect/users/user-1/sessions", StringComparison.Ordinal))
            {
                return JsonResponse(new[]
                {
                    new
                    {
                        id = "session-1",
                        userId = "user-1",
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

        var sessions = await sut.GetUserSessionsAsync("user-1", TestContext.Current.CancellationToken);

        sessions.Should().HaveCount(1);
        sessions[0].Id.Should().Be("session-1");
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
                && path.EndsWith("/admin/realms/iabconnect/users/missing-user/sessions", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var act = () => sut.GetUserSessionsAsync("missing-user", TestContext.Current.CancellationToken);

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
                && path.EndsWith("/admin/realms/iabconnect/users/user-2/sessions", StringComparison.Ordinal))
            {
                // Only an id; no ipAddress, no clients, no timestamps.
                return JsonResponse(new[] { new { id = "session-2" } });
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var sessions = await sut.GetUserSessionsAsync("user-2", TestContext.Current.CancellationToken);

        sessions.Should().HaveCount(1);
        sessions[0].Id.Should().Be("session-2");
        sessions[0].IpAddress.Should().BeNull();
        sessions[0].Start.Should().BeNull();
        sessions[0].LastAccess.Should().BeNull();
        sessions[0].Clients.Should().BeNull();
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
