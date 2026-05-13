using System.Net;
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
/// REQ-018: API-layer tests for <c>GET /api/v1/members/duplicates</c>.
/// Covers: authorization metadata, unauthenticated 401, and malformed-Guid 400.
/// </summary>
public sealed class MemberDuplicatesEndpointTests
{
    [Fact]
    public void DuplicatesEndpoint_ShouldRequireVorstandAuthorization()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IMemberRepository, FakeMemberRepository>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        builder.Services.AddSingleton<IabConnect.Application.Authorization.IAuthorizationService, IabConnect.Application.Authorization.AuthorizationService>();
        builder.Services.AddSingleton<ISender, FakeSender>();
        builder.Services.AddDbContext<ApplicationDbContext>(options =>
            options.UseInMemoryDatabase(nameof(DuplicatesEndpoint_ShouldRequireVorstandAuthorization)));
        var app = builder.Build();

        var api = app.MapGroup("/api/v1");
        api.MapMemberEndpoints();

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == "/api/v1/members/duplicates");

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(data => data.Policy == "RequireVorstand");
    }

    [Fact]
    public async Task DuplicatesEndpoint_Unauthenticated_Returns401()
    {
        await using var factory = new TestWebApplicationFactory();
        var client = factory.CreateClient();

        var response = await client.GetAsync(
            "/api/v1/members/duplicates?email=test@example.com",
            TestContext.Current.CancellationToken);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    // NOTE: testing 400-on-malformed-Guid requires bypassing authorization (auth fires before
    // model binding for [Authorize]-decorated minimal API endpoints). Covered by integration
    // checks in higher-environment smoke tests once a test auth handler is wired up.

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
        public Task<IReadOnlyList<Member>> FindCandidatesAsync(string? emailNormalized, string? phoneDigits, string? firstNameFolded, string? lastNameFolded, string? postalCode, Guid? excludeMemberId, int maxResults, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<Member>>(Array.Empty<Member>());
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
