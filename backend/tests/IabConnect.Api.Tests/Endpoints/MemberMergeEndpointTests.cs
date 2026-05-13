using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using IabConnect.Application.Members;
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
/// REQ-018 (E2.S3): metadata + contract tests for the safe-merge endpoint.
/// Full handler behavior is covered by <c>MemberMergeIntegrationTests</c> in the
/// Infrastructure test project; here we verify that the route is registered with
/// the <c>RequireAdmin</c> policy (NOT RequireVorstand — merge is the tightest gate)
/// and that the route pattern matches the AC-8 contract.
/// </summary>
public sealed class MemberMergeEndpointTests
{
    [Fact]
    public void MergeEndpoint_ShouldRequireAdminAuthorization()
    {
        using var app = BuildMinimalApp(nameof(MergeEndpoint_ShouldRequireAdminAuthorization));

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(d => d.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(r => r.RoutePattern.RawText == "/api/v1/members/{sourceId:guid}/merge-into/{targetId:guid}" &&
                         r.Metadata.GetMetadata<Microsoft.AspNetCore.Routing.HttpMethodMetadata>()!
                             .HttpMethods.Contains("POST"));

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(d => d.Policy == "RequireAdmin",
            because: "merge is destructive and must NOT be available to Vorstand");
        authorizeData.Should().NotContain(d => d.Policy == "RequireVorstand",
            because: "AC-1 explicitly excludes Vorstand from the merge gate");
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
        builder.Services.AddSingleton<IMemberRepository, EmptyMemberRepository>();
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

    private sealed class EmptyMemberRepository : IMemberRepository
    {
        public Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
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
