using System.Security.Claims;
using FluentAssertions;
using IabConnect.Api.Authorization;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Common;
using Microsoft.AspNetCore.Authorization;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace IabConnect.Api.Tests.Authorization;

/// <summary>
/// REQ-087 (E10-S3) AC-1/AC-3: unit coverage for <see cref="ModuleAuthorizationHandler"/> and
/// the <c>Module:</c> branch added to <see cref="PermissionPolicyProvider"/>. The handler must
/// succeed for an enabled module, must NOT succeed (and never <c>Fail()</c>) for a disabled
/// one, and must write a <see cref="AuditEventType.ModuleAccessDenied"/> audit event on denial.
/// </summary>
public sealed class ModuleAuthorizationHandlerTests
{
    private static AuthorizationHandlerContext CreateContext(ModuleRequirement requirement)
    {
        var user = new ClaimsPrincipal(new ClaimsIdentity());
        return new AuthorizationHandlerContext([requirement], user, resource: null);
    }

    [Fact]
    public async Task EnabledModule_Succeeds_AndWritesNoAuditEvent()
    {
        var moduleSettings = new Mock<IModuleSettingsService>();
        moduleSettings
            .Setup(s => s.IsEnabledAsync(ModuleKeys.Finance, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        var audit = new Mock<IAuditService>();

        var handler = new ModuleAuthorizationHandler(
            moduleSettings.Object, audit.Object, NullLogger<ModuleAuthorizationHandler>.Instance);
        var context = CreateContext(new ModuleRequirement(ModuleKeys.Finance));

        await handler.HandleAsync(context);

        context.HasSucceeded.Should().BeTrue();
        audit.VerifyNoOtherCalls();
    }

    [Fact]
    public async Task DisabledModule_DoesNotSucceed_DoesNotFail_AndAuditsModuleAccessDenied()
    {
        var moduleSettings = new Mock<IModuleSettingsService>();
        moduleSettings
            .Setup(s => s.IsEnabledAsync(ModuleKeys.Finance, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var audit = new Mock<IAuditService>();

        var handler = new ModuleAuthorizationHandler(
            moduleSettings.Object, audit.Object, NullLogger<ModuleAuthorizationHandler>.Instance);
        var context = CreateContext(new ModuleRequirement(ModuleKeys.Finance));

        await handler.HandleAsync(context);

        context.HasSucceeded.Should().BeFalse("a disabled module must yield 403 Forbidden");
        // Never Fail() — mirrors PermissionAuthorizationHandler so other handlers can still pass.
        context.HasFailed.Should().BeFalse();
        audit.Verify(a => a.LogActionAsync(
            AuditEventType.ModuleAccessDenied,
            It.IsAny<string>(),
            false,
            It.IsAny<string>(),
            "Module",
            ModuleKeys.Finance,
            It.IsAny<string>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task PolicyProvider_ModulePrefix_BuildsPolicyCarryingModuleRequirement()
    {
        var provider = new PermissionPolicyProvider(Options.Create(new AuthorizationOptions()));

        var policy = await provider.GetPolicyAsync($"Module:{ModuleKeys.Events}");

        policy.Should().NotBeNull();
        policy!.Requirements.OfType<ModuleRequirement>()
            .Should().ContainSingle()
            .Which.ModuleKey.Should().Be(ModuleKeys.Events);
    }

    [Fact]
    public async Task PolicyProvider_PermissionPrefix_StillResolves()
    {
        // The Module: branch must extend — not replace — the existing Permission: handling.
        var provider = new PermissionPolicyProvider(Options.Create(new AuthorizationOptions()));

        var policy = await provider.GetPolicyAsync("Permission:members.read");

        policy.Should().NotBeNull();
        policy!.Requirements.OfType<PermissionRequirement>().Should().ContainSingle();
    }
}
