using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Authentication;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using IabConnect.Infrastructure.Integration;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using System.Text.Encodings.Web;
using Xunit;

namespace IabConnect.Api.Tests.Authentication;

/// <summary>
/// REQ-058 (E8-S1, AC-2/3/4/5): unit tests for <see cref="ApiKeyAuthenticationHandler"/>. Proves the
/// additive contract (absent header → NoResult, no JWT regression), the valid-key happy path with
/// scope claims, and rejection of revoked / unknown / tampered / malformed credentials.
/// </summary>
public sealed class ApiKeyAuthenticationHandlerTests
{
    private static readonly ApiKeyHashingService Hashing =
        new(Options.Create(new ApiKeyOptions { ApiKeyPepper = "test-pepper" }));

    private static async Task<(AuthenticateResult Result, ClaimsPrincipal? Principal)> Authenticate(
        FakeRepo repo, string? headerValue)
    {
        var handler = new ApiKeyAuthenticationHandler(
            new StubOptionsMonitor(),
            NullLoggerFactory.Instance,
            UrlEncoder.Default,
            repo,
            Hashing,
            new NoOpAudit());

        var httpContext = new DefaultHttpContext();
        if (headerValue is not null)
            httpContext.Request.Headers[ApiKeyDefaults.HeaderName] = headerValue;

        var scheme = new AuthenticationScheme(
            ApiKeyDefaults.SchemeName, null, typeof(ApiKeyAuthenticationHandler));
        await handler.InitializeAsync(scheme, httpContext);
        var result = await handler.AuthenticateAsync();
        return (result, result.Principal);
    }

    [Fact]
    public async Task AbsentHeader_ReturnsNoResult()
    {
        var (result, _) = await Authenticate(new FakeRepo(), headerValue: null);
        result.None.Should().BeTrue("an absent key must fall through so JWT routes keep their 401");
        result.Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task ValidKey_Succeeds_WithScopeClaims()
    {
        var key = Hashing.Generate();
        var client = ApiClient.Create("Partner", [ApiScopes.EventsRead], key.Prefix, key.Hash);
        var repo = new FakeRepo(client);

        var (result, principal) = await Authenticate(repo, key.RawSecret);

        result.Succeeded.Should().BeTrue();
        principal!.FindFirst(ClaimTypes.NameIdentifier)!.Value.Should().Be(client.Id.ToString());
        principal.FindAll(ApiKeyDefaults.ScopeClaimType).Select(c => c.Value)
            .Should().Contain(ApiScopes.EventsRead);
        client.LastUsedAt.Should().NotBeNull("a successful auth records last-used");
    }

    [Fact]
    public async Task RevokedClient_Fails()
    {
        var key = Hashing.Generate();
        var client = ApiClient.Create("Partner", [ApiScopes.EventsRead], key.Prefix, key.Hash);
        client.Revoke();
        var (result, _) = await Authenticate(new FakeRepo(client), key.RawSecret);
        result.Succeeded.Should().BeFalse();
        result.None.Should().BeFalse();
    }

    [Fact]
    public async Task UnknownPrefix_Fails()
    {
        var key = Hashing.Generate();
        var (result, _) = await Authenticate(new FakeRepo(), key.RawSecret); // empty repo
        result.Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task TamperedKey_Fails()
    {
        var key = Hashing.Generate();
        var client = ApiClient.Create("Partner", [ApiScopes.EventsRead], key.Prefix, key.Hash);
        var (result, _) = await Authenticate(new FakeRepo(client), key.RawSecret + "x");
        result.Succeeded.Should().BeFalse();
    }

    [Fact]
    public async Task MalformedKey_Fails()
    {
        var (result, _) = await Authenticate(new FakeRepo(), "not-a-valid-key");
        result.Succeeded.Should().BeFalse();
    }

    // --- doubles ---

    private sealed class FakeRepo : IApiClientRepository
    {
        private readonly Dictionary<string, ApiClient> _byPrefix = new();

        public FakeRepo(params ApiClient[] clients)
        {
            foreach (var c in clients) _byPrefix[c.SecretPrefix] = c;
        }

        public Task<ApiClient?> GetByIdAsync(Guid id, CancellationToken ct = default)
            => Task.FromResult(_byPrefix.Values.FirstOrDefault(c => c.Id == id));
        public Task<ApiClient?> GetByPrefixAsync(string secretPrefix, CancellationToken ct = default)
            => Task.FromResult(_byPrefix.GetValueOrDefault(secretPrefix));
        public Task<IReadOnlyList<ApiClient>> GetAllAsync(CancellationToken ct = default)
            => Task.FromResult<IReadOnlyList<ApiClient>>(_byPrefix.Values.ToList());
        public Task AddAsync(ApiClient client, CancellationToken ct = default) { _byPrefix[client.SecretPrefix] = client; return Task.CompletedTask; }
        public Task UpdateAsync(ApiClient client, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class NoOpAudit : IAuditService
    {
        public Task LogAsync(AuditEvent auditEvent, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogLoginSuccessAsync(string userId, string userName, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogLoginFailureAsync(string? userName, string reason, string? ipAddress = null, string? userAgent = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogMemberCreatedAsync(string memberId, string memberName, string userId, string userName, string? details = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogMemberUpdatedAsync(string memberId, string memberName, string userId, string userName, string? changes = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogMemberDeletedAsync(string memberId, string memberName, string userId, string userName, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogUserActionAsync(AuditEventType eventType, string targetUserId, string targetUserName, string actorId, string actorName, string? details = null, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogDataExportAsync(string exportType, string userId, string userName, int recordCount, CancellationToken ct = default) => Task.CompletedTask;
        public Task LogActionAsync(AuditEventType eventType, string action, bool success = true, string? errorMessage = null, string? entityType = null, string? entityId = null, string? details = null, CancellationToken ct = default) => Task.CompletedTask;
    }

    private sealed class StubOptionsMonitor : IOptionsMonitor<AuthenticationSchemeOptions>
    {
        public AuthenticationSchemeOptions CurrentValue => new();
        public AuthenticationSchemeOptions Get(string? name) => new();
        public IDisposable? OnChange(Action<AuthenticationSchemeOptions, string?> listener) => null;
    }
}
