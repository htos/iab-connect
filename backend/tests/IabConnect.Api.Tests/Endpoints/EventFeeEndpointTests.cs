using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Endpoints;
using IabConnect.Application.Authorization;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-022 (E4-S1) AC-4 / AC-7: API-layer endpoint-metadata coverage for the fee-category surface.
/// Confirms every fee endpoint carries <c>RequireEventFeeManager</c> (the AC's "Event Manager or
/// Kassier"), the group-level authentication requirement, and the <c>Module:events</c> gate.
/// </summary>
public sealed class EventFeeEndpointTests
{
    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/", "GET")]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/", "POST")]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/{categoryId:guid}", "PUT")]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/{categoryId:guid}/deactivate", "POST")]
    public void FeeEndpoints_RequireEventFeeManagerPolicy(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == "RequireEventFeeManager");
    }

    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/", "GET")]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/", "POST")]
    public void FeeEndpoints_CarryModuleEventsGate(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>()
            .Should().Contain(d => d.Policy == "Module:events");
    }

    [Theory]
    [InlineData("/api/v1/events/{eventId:guid}/fee-categories/", "GET")]
    public void FeeEndpoints_AlsoCarryGroupAuth(string routePattern, string method)
    {
        var endpoint = ResolveEndpoint(routePattern, method);
        endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>().Should().Contain(d =>
            string.IsNullOrEmpty(d.Policy) && string.IsNullOrEmpty(d.Roles)
            && string.IsNullOrEmpty(d.AuthenticationSchemes));
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern, string httpMethod)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("RequireEventFeeManager", p => p.RequireRole("admin", "vorstand", "event-manager", "kassier"));
        builder.Services.AddSingleton<ISender, FakeSender>();
        builder.Services.AddSingleton<ISecurityAuditLogger, FakeSecurityAuditLogger>();

        var app = builder.Build();
        app.MapEventFeeEndpoints();

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
}
