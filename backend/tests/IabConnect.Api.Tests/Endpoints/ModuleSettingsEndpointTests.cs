using FluentAssertions;
using IabConnect.Api.Endpoints;
using MediatR;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Authorization.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace IabConnect.Api.Tests.Endpoints;

/// <summary>
/// REQ-087 (E10-S2) AC-1/AC-6 API surface: both module-settings endpoints MUST require the
/// <c>admin</c> role, and — being the self-lockout escape hatch — must never themselves be
/// module-gated. This test pins the admin-role policy at the metadata layer so a future
/// loosen-the-policy regression is caught without spinning up the host.
/// </summary>
public sealed class ModuleSettingsEndpointTests
{
    [Theory]
    [InlineData("/api/v1/module-settings/")]
    // Round-2 [Review][Patch] (P-S2-3): the PUT route param is constrained to
    // `{moduleKey:regex(^[a-z_]+$)}` for log-injection defense in depth — RawText
    // includes the constraint suffix.
    [InlineData("/api/v1/module-settings/{moduleKey:regex(^[a-z_]+$)}")]
    public void ModuleSettingsEndpoints_RequireAdminRole(string routePattern)
    {
        var endpoint = ResolveEndpoint(routePattern);

        var policy = endpoint.Metadata.GetMetadata<AuthorizationPolicy>();
        policy.Should().NotBeNull("the module-settings group calls RequireAuthorization with an admin-role policy");
        policy!.Requirements
            .OfType<RolesAuthorizationRequirement>()
            .SelectMany(r => r.AllowedRoles)
            .Should().Contain("admin");
    }

    [Theory]
    [InlineData("/api/v1/module-settings/")]
    // Round-2 [Review][Patch] (P-S2-3): the PUT route param is constrained to
    // `{moduleKey:regex(^[a-z_]+$)}` for log-injection defense in depth — RawText
    // includes the constraint suffix.
    [InlineData("/api/v1/module-settings/{moduleKey:regex(^[a-z_]+$)}")]
    public void ModuleSettingsEndpoints_AreReachable_RegardlessOfModuleState(string routePattern)
    {
        // Self-lockout guard (AC-6): E10-S3 introduces module enforcement but must skip this
        // group. There is no "Module:" gate concept yet, so the only authorization metadata
        // here is the admin-role policy — assert nothing else has been attached that could
        // gate the escape hatch.
        var endpoint = ResolveEndpoint(routePattern);

        var authorizeData = endpoint.Metadata.GetOrderedMetadata<IAuthorizeData>();
        authorizeData.Should().OnlyContain(data => string.IsNullOrEmpty(data.Roles));
    }

    private static RouteEndpoint ResolveEndpoint(string routePattern)
    {
        var builder = WebApplication.CreateBuilder();
        builder.Services.AddAuthorization();
        builder.Services.AddSingleton<ISender, FakeSender>();

        var app = builder.Build();
        app.MapModuleSettingsEndpoints();

        return ((IEndpointRouteBuilder)app).DataSources
            .SelectMany(dataSource => dataSource.Endpoints)
            .OfType<RouteEndpoint>()
            .Single(route => route.RoutePattern.RawText == routePattern);
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
}
