using System.Net;
using System.Text;
using System.Text.Json;
using FluentAssertions;
using IabConnect.Infrastructure.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Identity;

public sealed class KeycloakAdminServiceMfaTests
{
    private const string User1Id = "11111111-aaaa-bbbb-cccc-111111111111";
    private const string MissingUserId = "99999999-9999-9999-9999-999999999999";

    [Fact]
    public async Task ResetUserMfaAsync_RemovesOnlyMfaCredentialsAndSendsConfigureActions()
    {
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Get && path.EndsWith($"/admin/realms/iabconnect/users/{User1Id}/credentials", StringComparison.Ordinal))
            {
                return JsonResponse(new[]
                {
                    new { id = "otp-credential", type = "otp", userLabel = "Authenticator app" },
                    new { id = "password-credential", type = "password", userLabel = "Password" },
                    new { id = "recovery-credential", type = "recovery-authn-codes", userLabel = "Recovery codes" }
                });
            }

            if (request.Method == HttpMethod.Delete && path.Contains("/credentials/", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }

            if (request.Method == HttpMethod.Put && path.EndsWith($"/admin/realms/iabconnect/users/{User1Id}/execute-actions-email", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        await sut.ResetUserMfaAsync(User1Id, TestContext.Current.CancellationToken);

        handler.Requests.Should().Contain(request =>
            request.Method == HttpMethod.Delete
            && request.Path.EndsWith("/credentials/otp-credential", StringComparison.Ordinal));
        handler.Requests.Should().Contain(request =>
            request.Method == HttpMethod.Delete
            && request.Path.EndsWith("/credentials/recovery-credential", StringComparison.Ordinal));
        handler.Requests.Should().NotContain(request =>
            request.Method == HttpMethod.Delete
            && request.Path.EndsWith("/credentials/password-credential", StringComparison.Ordinal));

        var actionsRequest = handler.Requests.Single(request =>
            request.Method == HttpMethod.Put
            && request.Path.EndsWith("/execute-actions-email", StringComparison.Ordinal));

        actionsRequest.Body.Should().Contain("CONFIGURE_TOTP");
        actionsRequest.Body.Should().Contain("CONFIGURE_RECOVERY_AUTHN_CODES");
    }

    [Fact]
    public async Task ResetUserMfaAsync_WhenCredentialEndpointReturnsNotFound_ThrowsKeycloakNotFoundException()
    {
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Get && path.EndsWith($"/admin/realms/iabconnect/users/{MissingUserId}/credentials", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NotFound);
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var act = () => sut.ResetUserMfaAsync(MissingUserId, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<KeycloakNotFoundException>();
    }

    [Fact]
    public async Task ResetUserMfaAsync_WhenExecuteActionsEmailReturns400_ThrowsKeycloakActionEmailUnavailableException()
    {
        // S2.3: Keycloak rejects execute-actions-email when the user has no verified email.
        // At that point MFA credentials are already gone, so the service must surface a
        // distinct exception type that the API layer can convert into a 422.
        var handler = new RecordingHandler(request =>
        {
            var path = request.RequestUri?.AbsolutePath ?? "";

            if (path.EndsWith("/protocol/openid-connect/token", StringComparison.Ordinal))
            {
                return JsonResponse(new { access_token = "admin-token", expires_in = 300 });
            }

            if (request.Method == HttpMethod.Get && path.EndsWith($"/admin/realms/iabconnect/users/{User1Id}/credentials", StringComparison.Ordinal))
            {
                return JsonResponse(new[]
                {
                    new { id = "otp-credential", type = "otp", userLabel = "Authenticator app" },
                });
            }

            if (request.Method == HttpMethod.Delete && path.Contains("/credentials/", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.NoContent);
            }

            if (request.Method == HttpMethod.Put && path.EndsWith($"/admin/realms/iabconnect/users/{User1Id}/execute-actions-email", StringComparison.Ordinal))
            {
                return new HttpResponseMessage(HttpStatusCode.BadRequest)
                {
                    Content = new StringContent("{\"errorMessage\":\"User email missing\"}", Encoding.UTF8, "application/json")
                };
            }

            return new HttpResponseMessage(HttpStatusCode.NotFound);
        });

        var sut = CreateService(handler);

        var act = () => sut.ResetUserMfaAsync(User1Id, TestContext.Current.CancellationToken);

        var exception = await act.Should().ThrowAsync<KeycloakActionEmailUnavailableException>();
        exception.Which.DeletedCredentialCount.Should().Be(1);
        exception.Which.TotalCredentialCount.Should().Be(1);
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not-a-guid")]
    [InlineData("user-1")]
    [InlineData("../../etc/passwd")]
    public async Task ResetUserMfaAsync_WithNonGuidUserId_ThrowsArgumentException(string invalidUserId)
    {
        // S2.2: userId must be a valid GUID; reject before issuing any Keycloak request.
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var sut = CreateService(handler);

        var act = () => sut.ResetUserMfaAsync(invalidUserId, TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*GUID*");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData("not-a-guid")]
    [InlineData("user-1")]
    [InlineData("../../etc/passwd")]
    public async Task SendPasswordResetEmailAsync_WithNonGuidUserId_ThrowsArgumentException(string invalidUserId)
    {
        // S2.2: SendPasswordResetEmailAsync also interpolates userId; same GUID guard.
        var handler = new RecordingHandler(_ => new HttpResponseMessage(HttpStatusCode.NotFound));
        var sut = CreateService(handler);

        var act = () => sut.SendPasswordResetEmailAsync(invalidUserId, TestContext.Current.CancellationToken);

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
        private readonly List<RecordedRequest> _requests = [];

        public RecordingHandler(Func<HttpRequestMessage, HttpResponseMessage> handler)
        {
            _handler = handler;
        }

        public IReadOnlyList<RecordedRequest> Requests => _requests;

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var body = request.Content is null
                ? ""
                : await request.Content.ReadAsStringAsync(cancellationToken);

            _requests.Add(new RecordedRequest(
                request.Method,
                request.RequestUri?.AbsolutePath ?? "",
                body,
                request.Headers.Authorization?.Parameter));

            return _handler(request);
        }
    }

    private sealed record RecordedRequest(HttpMethod Method, string Path, string Body, string? BearerToken);
}
