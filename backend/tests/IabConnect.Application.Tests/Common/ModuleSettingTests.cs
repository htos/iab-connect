using FluentAssertions;
using IabConnect.Domain.Common;
using Xunit;

namespace IabConnect.Application.Tests.Common;

/// <summary>
/// REQ-087 (E10-S1): unit coverage for the <see cref="ModuleSetting"/> entity — the
/// <see cref="ModuleSetting.Create"/> factory guards the key, and
/// <see cref="ModuleSetting.SetEnabled"/> flips the flag and stamps the audit fields.
/// Mirrors the private-setter + explicit-method invariant pattern of <c>SystemSettings</c>.
/// </summary>
public sealed class ModuleSettingTests
{
    [Fact]
    public void Create_SetsKeyEnabledAndStampsAudit()
    {
        var setting = ModuleSetting.Create(ModuleKeys.Finance, enabled: false, updatedBy: "admin");

        setting.ModuleKey.Should().Be("finance");
        setting.Enabled.Should().BeFalse();
        setting.UpdatedBy.Should().Be("admin");
        setting.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        setting.Id.Should().NotBeEmpty();
    }

    [Fact]
    public void Create_TrimsModuleKey()
    {
        var setting = ModuleSetting.Create("  events  ", enabled: true, updatedBy: null);

        setting.ModuleKey.Should().Be("events");
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Create_BlankModuleKey_Throws(string? blank)
    {
        var act = () => ModuleSetting.Create(blank!, enabled: true, updatedBy: null);

        act.Should().Throw<ArgumentException>().WithParameterName("moduleKey");
    }

    [Fact]
    public void SetEnabled_FlipsFlagAndStampsAudit()
    {
        var setting = ModuleSetting.Create(ModuleKeys.Members, enabled: true, updatedBy: null);

        setting.SetEnabled(enabled: false, updatedBy: "admin");

        setting.Enabled.Should().BeFalse();
        setting.UpdatedBy.Should().Be("admin");
        setting.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }
}
