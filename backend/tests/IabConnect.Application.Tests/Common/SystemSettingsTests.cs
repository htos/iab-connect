using FluentAssertions;
using IabConnect.Domain.Common;
using Xunit;

namespace IabConnect.Application.Tests.Common;

/// <summary>
/// REQ-086 (E9-S1): unit coverage for the <see cref="SystemSettings"/> organization-profile
/// extension — <c>UpdateOrganizationProfile</c> trims/validates/clears the seven new fields
/// and <c>SetLogoAssetKey</c> owns the logo key. Mirrors the existing private-setter +
/// explicit-method invariant pattern.
/// </summary>
public sealed class SystemSettingsTests
{
    [Fact]
    public void CreateDefault_LeavesAllProfileFieldsNull()
    {
        var settings = SystemSettings.CreateDefault();

        settings.Description.Should().BeNull();
        settings.ContactEmail.Should().BeNull();
        settings.ContactPhone.Should().BeNull();
        settings.ContactAddress.Should().BeNull();
        settings.PrimaryColor.Should().BeNull();
        settings.PublicSiteEnabled.Should().BeNull();
        settings.LogoAssetKey.Should().BeNull();
    }

    [Fact]
    public void UpdateOrganizationProfile_TrimsValuesAndStampsAudit()
    {
        var settings = SystemSettings.CreateDefault();

        settings.UpdateOrganizationProfile(
            description: "  An association  ",
            contactEmail: "  info@acme.example  ",
            contactPhone: "  +41 11 222  ",
            contactAddress: "  Main Street 1  ",
            primaryColor: "  #EA580C  ",
            publicSiteEnabled: false,
            updatedBy: "admin");

        settings.Description.Should().Be("An association");
        settings.ContactEmail.Should().Be("info@acme.example");
        settings.ContactPhone.Should().Be("+41 11 222");
        settings.ContactAddress.Should().Be("Main Street 1");
        settings.PrimaryColor.Should().Be("#EA580C");
        settings.PublicSiteEnabled.Should().BeFalse();
        settings.UpdatedBy.Should().Be("admin");
        settings.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void UpdateOrganizationProfile_BlankValuesClearTheFields(string? blank)
    {
        var settings = SystemSettings.CreateDefault();
        settings.UpdateOrganizationProfile(
            "desc", "info@acme.example", "phone", "addr", "#FFFFFF", true);

        settings.UpdateOrganizationProfile(
            description: blank,
            contactEmail: blank,
            contactPhone: blank,
            contactAddress: blank,
            primaryColor: blank,
            publicSiteEnabled: null);

        settings.Description.Should().BeNull();
        settings.ContactEmail.Should().BeNull();
        settings.ContactPhone.Should().BeNull();
        settings.ContactAddress.Should().BeNull();
        settings.PrimaryColor.Should().BeNull();
        settings.PublicSiteEnabled.Should().BeNull();
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("missing@domain")]
    [InlineData("@no-local.com")]
    public void UpdateOrganizationProfile_InvalidEmail_Throws(string badEmail)
    {
        var settings = SystemSettings.CreateDefault();

        var act = () => settings.UpdateOrganizationProfile(
            null, badEmail, null, null, null, null);

        act.Should().Throw<ArgumentException>().WithParameterName("contactEmail");
    }

    [Theory]
    [InlineData("EA580C")]
    [InlineData("#GGGGGG")]
    [InlineData("#12345")]
    [InlineData("red")]
    public void UpdateOrganizationProfile_InvalidPrimaryColor_Throws(string badColor)
    {
        var settings = SystemSettings.CreateDefault();

        var act = () => settings.UpdateOrganizationProfile(
            null, null, null, null, badColor, null);

        act.Should().Throw<ArgumentException>().WithParameterName("primaryColor");
    }

    [Theory]
    [InlineData("#FFF")]
    [InlineData("#EA580C")]
    [InlineData("#EA580CFF")]
    public void UpdateOrganizationProfile_ValidHexShapes_AreAccepted(string color)
    {
        var settings = SystemSettings.CreateDefault();

        settings.UpdateOrganizationProfile(null, null, null, null, color, null);

        settings.PrimaryColor.Should().Be(color);
    }

    [Fact]
    public void SetLogoAssetKey_SetsKeyAndStampsAudit()
    {
        var settings = SystemSettings.CreateDefault();

        settings.SetLogoAssetKey("branding/logo-abc", "admin");

        settings.LogoAssetKey.Should().Be("branding/logo-abc");
        settings.UpdatedBy.Should().Be("admin");
        settings.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void SetLogoAssetKey_BlankClearsTheKey(string? blank)
    {
        var settings = SystemSettings.CreateDefault();
        settings.SetLogoAssetKey("branding/logo-abc", "admin");

        settings.SetLogoAssetKey(blank, "admin");

        settings.LogoAssetKey.Should().BeNull();
    }

    [Fact]
    public void UpdateOrganizationProfile_DoesNotTouchLogoAssetKey()
    {
        var settings = SystemSettings.CreateDefault();
        settings.SetLogoAssetKey("branding/logo-abc", "admin");

        settings.UpdateOrganizationProfile(
            "desc", null, null, null, null, null, "admin");

        settings.LogoAssetKey.Should().Be("branding/logo-abc");
    }
}
