using FluentAssertions;
using IabConnect.Domain.Authorization;
using Xunit;

namespace IabConnect.Application.Tests.Authorization;

/// <summary>
/// REQ-004 / REQ-018 (E2.S3): Role-to-permission mapping guardrails.
/// Member merge is admin-only — vorstand and member must NOT have it.
/// </summary>
public sealed class RolePermissionsTests
{
    [Theory]
    [InlineData("admin", Permission.MemberMerge, true)]
    [InlineData("vorstand", Permission.MemberMerge, false)]
    [InlineData("member", Permission.MemberMerge, false)]
    [InlineData("kassier", Permission.MemberMerge, false)]
    [InlineData("event-manager", Permission.MemberMerge, false)]
    [InlineData("auditor", Permission.MemberMerge, false)]
    public void MemberMerge_IsAdminOnly(string role, string permission, bool expected)
    {
        var actual = RolePermissions.HasPermission(new[] { role }, permission);

        actual.Should().Be(expected,
            because: $"role '{role}' {(expected ? "must" : "must NOT")} have '{permission}'");
    }

    [Fact]
    public void MemberMerge_NotImplicitlyGrantedByMultiRole()
    {
        // Regression: a user with both vorstand and member roles still does NOT inherit merge.
        var has = RolePermissions.HasPermission(new[] { "vorstand", "member" }, Permission.MemberMerge);
        has.Should().BeFalse();
    }

    [Fact]
    public void AdminWithMultiRole_StillHasMemberMerge()
    {
        var has = RolePermissions.HasPermission(new[] { "admin", "kassier" }, Permission.MemberMerge);
        has.Should().BeTrue();
    }
}
