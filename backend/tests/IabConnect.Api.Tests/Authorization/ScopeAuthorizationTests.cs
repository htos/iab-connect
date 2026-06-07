using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Authentication;
using IabConnect.Api.Authorization;
using IabConnect.Domain.Integration;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Xunit;

namespace IabConnect.Api.Tests.Authorization;

/// <summary>
/// REQ-058 (E8-S1, AC-3): unit tests for the <c>Scope:</c> authorization primitives — the
/// requirement handler succeeds only when the principal carries the scope claim, and the shared
/// policy provider builds a scope policy (and fails-fast on an unknown scope, mirroring Module:).
/// </summary>
public sealed class ScopeAuthorizationTests
{
    private static AuthorizationHandlerContext ContextWithScopes(ScopeRequirement requirement, params string[] scopes)
    {
        var claims = scopes.Select(s => new Claim(ApiKeyDefaults.ScopeClaimType, s));
        var principal = new ClaimsPrincipal(new ClaimsIdentity(claims, "ApiKey"));
        return new AuthorizationHandlerContext([requirement], principal, null);
    }

    [Fact]
    public async Task Handler_Succeeds_WhenScopePresent()
    {
        var requirement = new ScopeRequirement(ApiScopes.EventsRead);
        var context = ContextWithScopes(requirement, ApiScopes.EventsRead, ApiScopes.BlogRead);

        await new ScopeAuthorizationHandler(NullLogger<ScopeAuthorizationHandler>.Instance)
            .HandleAsync(context);

        context.HasSucceeded.Should().BeTrue();
    }

    [Fact]
    public async Task Handler_DoesNotSucceed_WhenScopeMissing()
    {
        var requirement = new ScopeRequirement(ApiScopes.EventsRead);
        var context = ContextWithScopes(requirement, ApiScopes.BlogRead);

        await new ScopeAuthorizationHandler(NullLogger<ScopeAuthorizationHandler>.Instance)
            .HandleAsync(context);

        context.HasSucceeded.Should().BeFalse();
    }

    [Fact]
    public async Task PolicyProvider_BuildsScopePolicy()
    {
        var provider = new PermissionPolicyProvider(Options.Create(new AuthorizationOptions()));
        var policy = await provider.GetPolicyAsync($"Scope:{ApiScopes.EventsRead}");

        policy.Should().NotBeNull();
        policy!.Requirements.OfType<ScopeRequirement>()
            .Should().ContainSingle(r => r.Scope == ApiScopes.EventsRead);
    }

    [Fact]
    public async Task PolicyProvider_ThrowsOnUnknownScope()
    {
        var provider = new PermissionPolicyProvider(Options.Create(new AuthorizationOptions()));
        var act = async () => await provider.GetPolicyAsync("Scope:members:read");
        await act.Should().ThrowAsync<InvalidOperationException>();
    }
}
