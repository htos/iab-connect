using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Identity;
using IabConnect.Infrastructure.Persistence;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests;

public sealed class UserEndpointMetadataTests
{
    [Fact]
    public void ResetMfaEndpoint_ShouldRequireAdminAuthorization()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IKeycloakAdminService, FakeKeycloakAdminService>();
        builder.Services.AddSingleton<IMemberRepository, FakeMemberRepository>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase("UserEndpointMetadataTests"));
        var app = builder.Build();

        app.MapUserEndpoints();

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == "/api/v1/users/{userId}/reset-mfa");

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(data => data.Policy == "RequireAdmin");
    }

    [Fact]
    public void GetUserSessionsEndpoint_ShouldRequireAdminAuthorization()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IKeycloakAdminService, FakeKeycloakAdminService>();
        builder.Services.AddSingleton<IMemberRepository, FakeMemberRepository>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase("UserEndpointMetadataTests_Sessions"));
        var app = builder.Build();

        app.MapUserEndpoints();

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == "/api/v1/users/{userId}/sessions");

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(data => data.Policy == "RequireAdmin");
    }

    [Fact]
    public void RevokeUserSessionEndpoint_ShouldRequireAdminAuthorization()
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<IKeycloakAdminService, FakeKeycloakAdminService>();
        builder.Services.AddSingleton<IMemberRepository, FakeMemberRepository>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseInMemoryDatabase("UserEndpointMetadataTests_RevokeSession"));
        var app = builder.Build();

        app.MapUserEndpoints();

        var endpoint = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == "/api/v1/users/{userId}/sessions/{sessionId}");

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();

        authorizeData.Should().Contain(data => data.Policy == "RequireAdmin");
    }

    private sealed class FakeKeycloakAdminService : IKeycloakAdminService
    {
        public Task<KeycloakUser?> GetUserByIdAsync(string userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<KeycloakUser?> GetUserByEmailAsync(string email, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<KeycloakUser>> GetUsersAsync(string? search = null, int? first = null, int? max = null, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<int> GetUserCountAsync(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<string> CreateUserAsync(CreateKeycloakUserRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task UpdateUserAsync(string userId, UpdateKeycloakUserRequest request, CancellationToken ct = default) => throw new NotImplementedException();
        public Task DeleteUserAsync(string userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task SetUserEnabledAsync(string userId, bool enabled, CancellationToken ct = default) => throw new NotImplementedException();
        public Task SendPasswordResetEmailAsync(string userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task ResetUserMfaAsync(string userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<KeycloakRole>> GetUserRolesAsync(string userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task AssignRolesToUserAsync(string userId, IEnumerable<string> roleNames, CancellationToken ct = default) => throw new NotImplementedException();
        public Task RemoveRolesFromUserAsync(string userId, IEnumerable<string> roleNames, CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<KeycloakRole>> GetAvailableRolesAsync(CancellationToken ct = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<KeycloakSessionRepresentation>> GetUserSessionsAsync(string userId, CancellationToken ct = default) => throw new NotImplementedException();
        public Task RevokeSessionAsync(string sessionId, CancellationToken ct = default) => throw new NotImplementedException();
    }

    private sealed class FakeMemberRepository : IMemberRepository
    {
        public Task<Member?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyDictionary<Guid, Member>> GetByIdsAsync(IReadOnlyCollection<Guid> ids, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<Member?> GetByEmailAsync(string email, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<Member?> GetByKeycloakUserIdAsync(Guid keycloakUserId, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<Member?> GetByCalendarTokenAsync(string token, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Member>> GetAllAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<(IReadOnlyList<Member> Items, int TotalCount)> GetPagedAsync(int page, int pageSize, string? searchTerm = null, MembershipStatus? status = null, MembershipType? type = null, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task AddAsync(Member member, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public void Update(Member member) => throw new NotImplementedException();
        public void Remove(Member member) => throw new NotImplementedException();
        public Task<bool> ExistsAsync(Guid id, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<bool> EmailExistsAsync(string email, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<Member?> GetByEmailNormalizedAsync(string email, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<bool> EmailExistsNormalizedAsync(string email, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Member>> FindCandidatesAsync(string? emailNormalized, string? phoneDigits, string? firstNameFolded, string? lastNameFolded, string? postalCode, Guid? excludeMemberId, int maxResults, CancellationToken cancellationToken = default) => throw new NotImplementedException();
        public Task<IReadOnlyList<Member>> GetAllNonMergedAsync(CancellationToken cancellationToken = default) => throw new NotImplementedException();
    }

    private sealed class FakeSecurityAuditLogger : ISecurityAuditLogger
    {
        public void LogAccessDenied(ClaimsPrincipal user, string resource, string action, string reason, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAccessGranted(ClaimsPrincipal user, string resource, string action, string? resourceId = null, IDictionary<string, object>? additionalData = null) { }
        public void LogAuthenticationFailure(string? username, string reason, string? ipAddress = null) { }
        public void LogSuspiciousActivity(ClaimsPrincipal? user, string activity, string details, string? ipAddress = null) { }
    }
}
