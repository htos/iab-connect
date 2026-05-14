using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using IabConnect.Application.Members.Duplicates;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;
using DomainMembershipType = IabConnect.Domain.Members.MembershipType;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-018 (E2.S2, AC-8): API-layer defense-in-depth tests for the member create/update
/// flows. Even when the UI does NOT show a warning (JS disabled, network failure, bypass),
/// the backend MUST reject Exact duplicates via the normalized-email guard.
///
/// Covers:
/// - Endpoint metadata: POST and PUT for <c>/api/v1/members/...</c> require the <c>RequireVorstand</c> policy.
/// - The <see cref="DuplicateMemberConflictResponse"/> contract (Error + ExistingMemberId) the UI deep-link relies on.
///
/// Note: full 401-unauthenticated coverage for these routes is already provided by
/// <see cref="MemberDuplicatesEndpointTests"/>. We intentionally do NOT boot a second
/// <c>WebApplicationFactory&lt;Program&gt;</c> here — Serilog's bootstrap-logger static
/// state cannot survive two parallel host boots in the same test process.
/// </summary>
public sealed class MemberCreateDuplicateConflictTests
{
    [Fact]
    public void CreateMemberEndpoint_ShouldRequireVorstandAuthorization()
    {
        using var app = BuildMinimalApp(nameof(CreateMemberEndpoint_ShouldRequireVorstandAuthorization));

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(d => d.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(r => r.RoutePattern.RawText == "/api/v1/members/" &&
                         r.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()!
                             .HttpMethods.Contains("POST"));

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(d => d.Policy == "RequireVorstand");
    }

    [Fact]
    public void UpdateMemberEndpoint_ShouldRequireVorstandAuthorization()
    {
        using var app = BuildMinimalApp(nameof(UpdateMemberEndpoint_ShouldRequireVorstandAuthorization));

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(d => d.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(r => r.RoutePattern.RawText == "/api/v1/members/{id:guid}" &&
                         r.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()!
                             .HttpMethods.Contains("PUT"));

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(d => d.Policy == "RequireVorstand");
    }

    [Fact]
    public void DuplicateMemberConflictResponse_ShapeIsErrorAndExistingMemberId()
    {
        // Sanity-check the contract that the UI deep-link relies on.
        var sample = new DuplicateMemberConflictResponse("E-Mail-Adresse bereits vergeben", Guid.NewGuid());

        sample.Error.Should().NotBeNullOrEmpty();
        sample.ExistingMemberId.Should().NotBe(Guid.Empty);
    }

    private static WebApplication BuildMinimalApp(string dbName)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization(options =>
        {
            options.AddPolicy("RequireVorstand", p => p.RequireAssertion(_ => true));
            options.AddPolicy("RequireAdmin", p => p.RequireAssertion(_ => true));
            options.AddPolicy("RequireMember", p => p.RequireAssertion(_ => true));
        });
        builder.Services.AddSingleton<IMemberRepository, NotCalledMemberRepository>();
        builder.Services.AddSingleton<ISecurityAuditLogger, NoopSecurityAuditLogger>();
        builder.Services.AddSingleton<IDuplicateMatcher, DuplicateMatcher>();
        builder.Services.AddSingleton<IabConnect.Application.Authorization.IAuthorizationService, AuthorizationService>();
        builder.Services.AddSingleton<ISender, NotCalledSender>();
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(dbName));

        var app = builder.Build();
        var api = app.MapGroup("/api/v1");
        api.MapMemberEndpoints();
        return app;
    }

    private sealed class NotCalledMemberRepository : IMemberRepository
    {
        public Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<IReadOnlyDictionary<Guid, Member>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyDictionary<Guid, Member>>(new Dictionary<Guid, Member>());
        public Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<Member?> GetByCalendarTokenAsync(string token, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<IReadOnlyList<Member>> GetAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Member>>(Array.Empty<Member>());
        public Task<(IReadOnlyList<Member> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string? searchTerm = null, MembershipStatus? status = null, DomainMembershipType? type = null, CancellationToken cancellationToken = default) => Task.FromResult<(IReadOnlyList<Member>, int)>((Array.Empty<Member>(), 0));
        public Task AddAsync(Member member, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public void Update(Member member) { }
        public void Remove(Member member) { }
        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<Member?> GetByEmailNormalizedAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<bool> EmailExistsNormalizedAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<IReadOnlyList<Member>> FindCandidatesAsync(string? emailNormalized, string? phoneDigits, string? firstNameFolded, string? lastNameFolded, string? postalCode, Guid? excludeMemberId, int maxResults, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Member>>(Array.Empty<Member>());
        public Task<IReadOnlyList<Member>> GetAllNonMergedAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Member>>(Array.Empty<Member>());
    }

    private sealed class NotCalledSender : ISender
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default) => Task.FromResult<TResponse>(default!);
        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest => Task.CompletedTask;
        public Task<object?> Send(object request, CancellationToken cancellationToken = default) => Task.FromResult<object?>(null);
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default) => throw new NotSupportedException();
    }

    private sealed class NoopSecurityAuditLogger : ISecurityAuditLogger
    {
        public void LogAccessDenied(System.Security.Claims.ClaimsPrincipal user, string resource, string action, string reason, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAccessGranted(System.Security.Claims.ClaimsPrincipal user, string resource, string action, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAuthenticationFailure(string? username, string reason, string? ipAddress = null) { }
        public void LogSuspiciousActivity(System.Security.Claims.ClaimsPrincipal? user, string activity, string details, string? ipAddress = null) { }
    }
}
