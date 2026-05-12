using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using IabConnect.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Identity;

public sealed class KeycloakAdminServiceRevokeSessionTests
{
    [Fact]
    public async Task RevokeSessionAsync_SendsDeleteToKeycloakSessionsEndpoint()
    {
        HttpRequestMessage? capturedDelete = null;
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Delete
                && path.EndsWith("/admin/realms/iabconnect/sessions/session-1", StringComparison.Ordinal))
            {
                capturedDelete = request;
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        await sut.RevokeSessionAsync("session-1", TestContext.Current.CancellationToken);

        capturedDelete.Should().NotBeNull();
        capturedDelete!.Method.Should().Be(HttpMethod.Delete);
        capturedDelete.Headers.Authorization!.Scheme.Should().Be("Bearer");
        capturedDelete.Headers.Authorization.Parameter.Should().Be("admin-token");
    }

    [Fact]
    public async Task RevokeSessionAsync_When404_ThrowsKeycloakNotFoundException()
    {
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Delete
                && path.EndsWith("/admin/realms/iabconnect/sessions/missing-session", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var act = () => sut.RevokeSessionAsync("missing-session", TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<KeycloakNotFoundException>();
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
