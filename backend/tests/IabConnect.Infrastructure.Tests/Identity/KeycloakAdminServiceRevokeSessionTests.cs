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
    private const string Session1Id = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    private const string MissingSessionId = "dddddddd-dddd-dddd-dddd-dddddddddddd";

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
                && path.EndsWith($"/admin/realms/iabconnect/sessions/{Session1Id}", StringComparison.Ordinal))
            {
                capturedDelete = request;
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        await sut.RevokeSessionAsync(Session1Id, TestContext.Current.CancellationToken);

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
                && path.EndsWith($"/admin/realms/iabconnect/sessions/{MissingSessionId}", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var act = () => sut.RevokeSessionAsync(MissingSessionId, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<KeycloakNotFoundException>();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not-a-guid")]
    [InlineData("session-1")]
    [InlineData("../../etc/passwd")]
    public async Task RevokeSessionAsync_WithNonGuidSessionId_ThrowsArgumentException(string invalidSessionId)
    {
        // P1: sessionId must be a valid GUID; reject before issuing any Keycloak request.
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var sut = CreateService(handler);

        var act = () => sut.RevokeSessionAsync(invalidSessionId, TestContext.Current.CancellationToken);

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
