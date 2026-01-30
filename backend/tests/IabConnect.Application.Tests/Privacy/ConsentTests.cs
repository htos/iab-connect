using FluentAssertions;
using IabConnect.Domain.Privacy;
using Xunit;

namespace IabConnect.Application.Tests.Privacy;

/// <summary>
/// Unit tests for Consent entity (REQ-012: DSGVO/Privacy)
/// </summary>
public class ConsentTests
{
    private readonly Guid _userId = Guid.NewGuid();
    private const string PolicyVersion = "1.0.0";
    private const string IpAddress = "192.168.1.1";
    private const string UserAgent = "Mozilla/5.0 Test";

    [Fact]
    public void Grant_NewConsent_ShouldSetIsGrantedTrue()
    {
        // Act
        var consent = Consent.Grant(_userId, ConsentType.Newsletter, PolicyVersion, IpAddress, UserAgent);

        // Assert
        consent.IsGranted.Should().BeTrue();
        consent.GrantedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        consent.RevokedAt.Should().BeNull();
        consent.PolicyVersion.Should().Be(PolicyVersion);
        consent.IpAddress.Should().Be(IpAddress);
        consent.UserAgent.Should().Be(UserAgent);
        consent.UserId.Should().Be(_userId);
        consent.Type.Should().Be(ConsentType.Newsletter);
    }

    [Fact]
    public void Revoke_GrantedConsent_ShouldSetIsGrantedFalse()
    {
        // Arrange
        var consent = Consent.Grant(_userId, ConsentType.Newsletter, PolicyVersion, IpAddress, UserAgent);

        // Act
        consent.Revoke();

        // Assert
        consent.IsGranted.Should().BeFalse();
        consent.RevokedAt.Should().NotBeNull();
        consent.RevokedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void ReGrant_RevokedConsent_ShouldSetIsGrantedTrueAgain()
    {
        // Arrange
        var consent = Consent.Grant(_userId, ConsentType.Marketing, PolicyVersion, IpAddress, UserAgent);
        consent.Revoke();
        var newPolicyVersion = "2.0.0";

        // Act
        consent.ReGrant(newPolicyVersion, IpAddress, UserAgent);

        // Assert
        consent.IsGranted.Should().BeTrue();
        consent.GrantedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        consent.RevokedAt.Should().BeNull();
        consent.PolicyVersion.Should().Be(newPolicyVersion);
    }

    [Theory]
    [InlineData(ConsentType.DataProcessing)]
    [InlineData(ConsentType.Newsletter)]
    [InlineData(ConsentType.Marketing)]
    [InlineData(ConsentType.EventNotifications)]
    [InlineData(ConsentType.PhotoUsage)]
    public void Grant_WithDifferentTypes_ShouldSetCorrectType(ConsentType type)
    {
        // Act
        var consent = Consent.Grant(_userId, type, PolicyVersion);

        // Assert
        consent.Type.Should().Be(type);
        consent.UserId.Should().Be(_userId);
        consent.IsGranted.Should().BeTrue();
    }

    [Fact]
    public void Grant_ShouldGenerateNewId()
    {
        // Act
        var consent1 = Consent.Grant(_userId, ConsentType.Newsletter, PolicyVersion);
        var consent2 = Consent.Grant(_userId, ConsentType.Newsletter, PolicyVersion);

        // Assert
        consent1.Id.Should().NotBe(Guid.Empty);
        consent2.Id.Should().NotBe(Guid.Empty);
        consent1.Id.Should().NotBe(consent2.Id);
    }

    [Fact]
    public void Revoke_AlreadyRevokedConsent_ShouldNotChangeRevokedAt()
    {
        // Arrange
        var consent = Consent.Grant(_userId, ConsentType.Newsletter, PolicyVersion);
        consent.Revoke();
        var firstRevokedAt = consent.RevokedAt;

        // Act - try to revoke again
        consent.Revoke();

        // Assert - should not change (method returns early)
        consent.RevokedAt.Should().Be(firstRevokedAt);
    }
}
