using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-018 (E2.S4): API-layer metadata tests for the two new duplicate endpoints:
///   GET  /api/v1/members/duplicate-groups       — Vorstand-only
///   POST /api/v1/members/duplicate-dismissals   — Vorstand-only
/// </summary>
/// <remarks>
/// Metadata-only assertions (no <c>TestWebApplicationFactory</c>) — verifying the
/// <c>RequireVorstand</c> policy is wired is the same guarantee an integration 401 test would
/// give, without the flaky Serilog "logger is already frozen" race that occurs when multiple
/// <c>WebApplicationFactory</c> instances boot in the same xUnit run.
/// </remarks>
public sealed class MemberDuplicateGroupsEndpointTests
{
    [Fact]
    public void DuplicateGroupsEndpoint_ShouldRequireVorstandAuthorization()
    {
        var endpoint = ResolveEndpoint("/api/v1/members/duplicate-groups");
        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
        authorizeData.Should().Contain(data => data.Policy == "RequireVorstand");
    }

    [Fact]
    public void DuplicateDismissalsEndpoint_ShouldRequireVorstandAuthorization()
    {
        var endpoint = ResolveEndpoint("/api/v1/members/duplicate-dismissals");
        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
        authorizeData.Should().Contain(data => data.Policy == "RequireVorstand");
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IMemberRepository, FakeMemberRepository>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        builder.Services.AddSingleton<IabConnect.Application.Authorization.IAuthorizationService, IabConnect.Application.Authorization.AuthorizationService>();
        builder.Services.AddSingleton<ISender, FakeSender>();
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase($"E2S4-Metadata-{routePattern}"));
        var app = builder.Build();

        var api = app.MapGroup("/api/v1");
        api.MapMemberEndpoints();

        return ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == routePattern);
    }

    private sealed class FakeMemberRepository : IMemberRepository
    {
        public Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default) => Task.FromResult<Member?>(null);
        public Task<IReadOnlyList<Member>> GetAllAsync(CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Member>>(Array.Empty<Member>());
        public Task<(IReadOnlyList<Member> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string? searchTerm = null, MembershipStatus? status = null, MembershipType? type = null, CancellationToken cancellationToken = default) => Task.FromResult<(IReadOnlyList<Member>, int)>((Array.Empty<Member>(), 0));
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

    private sealed class FakeSender : ISender
    {
        public Task<TResponse> Send<TResponse>(IRequest<TResponse> request, CancellationToken cancellationToken = default)
            => Task.FromResult<TResponse>(default!);
        public Task Send<TRequest>(TRequest request, CancellationToken cancellationToken = default) where TRequest : IRequest
            => Task.CompletedTask;
        public Task<object?> Send(object request, CancellationToken cancellationToken = default)
            => Task.FromResult<object?>(null);
        public IAsyncEnumerable<TResponse> CreateStream<TResponse>(IStreamRequest<TResponse> request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
        public IAsyncEnumerable<object?> CreateStream(object request, CancellationToken cancellationToken = default)
            => throw new NotSupportedException();
    }

    private sealed class FakeSecurityAuditLogger : ISecurityAuditLogger
    {
        public void LogAccessDenied(ClaimsPrincipal user, string resource, string action, string reason, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAccessGranted(ClaimsPrincipal user, string resource, string action, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAuthenticationFailure(string? username, string reason, string? ipAddress = null) { }
        public void LogSuspiciousActivity(ClaimsPrincipal? user, string activity, string details, string? ipAddress = null) { }
    }
}
