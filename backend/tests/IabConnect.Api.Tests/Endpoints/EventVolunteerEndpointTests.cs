using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using IabConnect.Application.Events.Volunteers;
using IabConnect.Domain.Events.Volunteers;
using IabConnect.Domain.Members;
using IabConnect.Infrastructure.Persistence;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Moq;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-024 (E3.S3) AC-10: API-layer endpoint-metadata coverage.
/// Confirms <c>RequireEventStaff</c> for CRUD endpoints; <c>RequireMember</c> for reads + self-signup.
/// </summary>
public sealed class EventVolunteerEndpointTests
{
    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-roles/", "RequireEventStaff", "POST")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-roles/{roleId:guid}", "RequireEventStaff", "PUT")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/", "RequireEventStaff", "POST")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}", "RequireEventStaff", "PUT")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/cancel", "RequireEventStaff", "POST")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/assignments", "RequireEventStaff", "POST")]
    public void StaffEndpoints_RequireEventStaffPolicy(string routePattern, string expectedPolicy, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == expectedPolicy);
    }

    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-roles/", "GET")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/", "GET")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/assignments", "GET")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/self-signup", "POST")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/{shiftId:guid}/assignments/{assignmentId:guid}/cancel", "POST")]
    public void MemberEndpoints_RequireMemberPolicy(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == "RequireMember");
    }

    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-roles/")]
    [InlineData("/api/v1/events/{eventId:guid}/volunteer-shifts/")]
    public void AllEndpoints_AlsoCarryGroupAuth(string routePattern)
    {
        // The group-level .RequireAuthorization() adds a default policy entry — its presence
        // guarantees unauthenticated callers cannot reach the handler.
        var endpoint = ResolveEndpoint(routePattern, "GET");
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Should().Contain(d =>
            string.IsNullOrEmpty(d.Policy) && string.IsNullOrEmpty(d.Roles)
            && string.IsNullOrEmpty(d.AuthenticationSchemes));
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern, string httpMethod)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("RequireEventStaff", p => p.RequireRole("admin", "vorstand", "event-manager"))
            .AddPolicy("RequireMember", p => p.RequireRole("admin", "vorstand", "member"));

        builder.Services.AddSingleton<ISender, FakeSender>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();
        builder.Services.AddSingleton<IEventVolunteerRoleRepository, FakeRoleRepo>();
        builder.Services.AddSingleton<IEventVolunteerShiftRepository, FakeShiftRepo>();
        builder.Services.AddSingleton<IEventVolunteerAssignmentRepository, FakeAssignmentRepo>();
        builder.Services.AddSingleton(new Mock<IMemberRepository>().Object);
        builder.Services.AddSingleton<IEventVolunteerAssignmentService, FakeAssignmentService>();
        builder.Services.AddDbContext<ApplicationDbContext>(o => o.UseInMemoryDatabase($"vol-{routePattern}-{httpMethod}"));

        var app = builder.Build();
        app.MapEventVolunteerEndpoints();

        var endpoints = ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(d => d.Endpoints)
            .OfType<RouteEndpoint>()
            .Where(r => r.RoutePattern.RawText == routePattern)
            .ToList();
        endpoints.Should().NotBeEmpty($"route {routePattern} should be registered");
        return endpoints.Single(r => r.Metadata.GetOrderedMetadata<HttpMethodMetadata>()
            .Any(m => m.HttpMethods.Contains(httpMethod)));
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
        public void LogPermissionEscalation(ClaimsPrincipal user, string targetUserId, string fromRole, string toRole) { }
        public void LogSuspiciousActivity(ClaimsPrincipal? user, string activity, string details, string? ipAddress = null) { }
    }

    private sealed class FakeRoleRepo : IEventVolunteerRoleRepository
    {
        public Task AddAsync(EventVolunteerRole role, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task UpdateAsync(EventVolunteerRole role, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<EventVolunteerRole?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<EventVolunteerRole?>(null);
        public Task<IReadOnlyList<EventVolunteerRole>> GetByEventIdAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventVolunteerRole>>(Array.Empty<EventVolunteerRole>());
        public Task<EventVolunteerRole?> GetByEventAndNameAsync(Guid eventId, string name, CancellationToken cancellationToken = default) => Task.FromResult<EventVolunteerRole?>(null);
    }

    private sealed class FakeShiftRepo : IEventVolunteerShiftRepository
    {
        public Task AddAsync(EventVolunteerShift shift, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task UpdateAsync(EventVolunteerShift shift, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<EventVolunteerShift?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<EventVolunteerShift?>(null);
        public Task<IReadOnlyList<EventVolunteerShift>> GetByEventIdAsync(Guid eventId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventVolunteerShift>>(Array.Empty<EventVolunteerShift>());
        public Task<IReadOnlyList<EventVolunteerShift>> GetByRoleIdAsync(Guid roleId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventVolunteerShift>>(Array.Empty<EventVolunteerShift>());
    }

    private sealed class FakeAssignmentRepo : IEventVolunteerAssignmentRepository
    {
        public Task AddAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task UpdateAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default) => Task.CompletedTask;
        public Task<EventVolunteerAssignment?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default) => Task.FromResult<EventVolunteerAssignment?>(null);
        public Task<(EventVolunteerAssignment Persisted, bool Created)> AddAtomicAsync(EventVolunteerAssignment assignment, CancellationToken cancellationToken = default) => Task.FromResult((assignment, true));
        public Task<int> CountConfirmedAsync(Guid shiftId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<int> CountWaitlistedAsync(Guid shiftId, CancellationToken cancellationToken = default) => Task.FromResult(0);
        public Task<IReadOnlyList<EventVolunteerAssignment>> GetWaitlistAsync(Guid shiftId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventVolunteerAssignment>>(Array.Empty<EventVolunteerAssignment>());
        public Task<IReadOnlyList<EventVolunteerAssignment>> GetByShiftIdAsync(Guid shiftId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventVolunteerAssignment>>(Array.Empty<EventVolunteerAssignment>());
        public Task<IReadOnlyList<EventVolunteerAssignment>> GetByMemberIdAsync(Guid memberId, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<EventVolunteerAssignment>>(Array.Empty<EventVolunteerAssignment>());
        public Task<bool> ExistsActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<EventVolunteerAssignment?> GetActiveForMemberAsync(Guid shiftId, Guid memberId, CancellationToken cancellationToken = default) => Task.FromResult<EventVolunteerAssignment?>(null);
        public Task<bool> MarkReminderSentAsync(Guid assignmentId, DateTime sentAtUtc, CancellationToken cancellationToken = default) => Task.FromResult(false);
        public Task<IReadOnlyList<VolunteerReminderDueRow>> GetRemindersDueAsync(DateTime windowStartUtc, DateTime windowEndUtc, CancellationToken cancellationToken = default) => Task.FromResult<IReadOnlyList<VolunteerReminderDueRow>>(Array.Empty<VolunteerReminderDueRow>());
    }

    private sealed class FakeAssignmentService : IEventVolunteerAssignmentService
    {
        public Task<VolunteerAssignmentResult> AssignAsync(Guid eventId, Guid shiftId, Guid memberId, Guid assignedBy, bool allowWaitlistFallback, bool isSelfSignup, CancellationToken cancellationToken = default)
            => Task.FromResult(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.ShiftNotFound, null));
        public Task<VolunteerAssignmentResult> CancelAssignmentAsync(Guid assignmentId, string? reason, Guid eventId, Guid? callerMemberId, bool callerIsStaff, CancellationToken cancellationToken = default)
            => Task.FromResult(new VolunteerAssignmentResult(VolunteerAssignmentOutcome.AssignmentNotFound, null));
        public Task<CancelShiftServiceResult> CancelAllAssignmentsForShiftAsync(Guid eventId, Guid shiftId, string? reason, CancellationToken cancellationToken = default)
            => Task.FromResult(new CancelShiftServiceResult(true, 0));
        public Task<UpdateShiftCapacityResult> UpdateShiftCapacityAsync(Guid eventId, Guid shiftId, int newCapacity, CancellationToken cancellationToken = default)
            => Task.FromResult(new UpdateShiftCapacityResult(UpdateShiftCapacityOutcome.Updated, newCapacity, 0));
    }
}
