using FluentAssertions;
using IabConnect.Domain.Audit;
using Xunit;

namespace IabConnect.Application.Tests.Audit;

/// <summary>
/// Unit tests for AuditEvent entity (REQ-011)
/// </summary>
public class AuditEventTests
{
    #region Create Tests

    [Fact]
    public void Create_BasicEvent_ShouldSetRequiredProperties()
    {
        // Act
        var auditEvent = AuditEvent.Create(
            AuditEventType.LoginSuccess,
            AuditCategory.Authentication,
            "User logged in");

        // Assert
        auditEvent.EventType.Should().Be(AuditEventType.LoginSuccess);
        auditEvent.Category.Should().Be(AuditCategory.Authentication);
        auditEvent.Action.Should().Be("User logged in");
        auditEvent.Severity.Should().Be(AuditSeverity.Info); // Default
        auditEvent.Success.Should().BeTrue(); // Default
    }

    [Fact]
    public void Create_WithAllParameters_ShouldSetAllProperties()
    {
        // Arrange
        var userId = "user-123";
        var userName = "max@example.com";
        var entityType = "Member";
        var entityId = "member-456";
        var details = "{\"changes\": [\"name\"]}";
        var ipAddress = "192.168.1.1";
        var userAgent = "Mozilla/5.0";

        // Act
        var auditEvent = AuditEvent.Create(
            AuditEventType.MemberUpdated,
            AuditCategory.MemberManagement,
            "Member updated",
            userId,
            userName,
            entityType,
            entityId,
            details,
            ipAddress,
            userAgent,
            AuditSeverity.Info,
            true,
            null);

        // Assert
        auditEvent.UserId.Should().Be(userId);
        auditEvent.UserName.Should().Be(userName);
        auditEvent.EntityType.Should().Be(entityType);
        auditEvent.EntityId.Should().Be(entityId);
        auditEvent.Details.Should().Be(details);
        auditEvent.IpAddress.Should().Be(ipAddress);
        auditEvent.UserAgent.Should().Be(userAgent);
    }

    [Fact]
    public void Create_ShouldSetTimestampToNow()
    {
        // Arrange
        var before = DateTime.UtcNow.AddSeconds(-1);

        // Act
        var auditEvent = AuditEvent.Create(
            AuditEventType.LoginSuccess,
            AuditCategory.Authentication,
            "User logged in");

        var after = DateTime.UtcNow.AddSeconds(1);

        // Assert
        auditEvent.Timestamp.Should().BeAfter(before).And.BeBefore(after);
    }

    [Fact]
    public void Create_FailedEvent_ShouldSetSuccessAndErrorMessage()
    {
        // Act
        var auditEvent = AuditEvent.Create(
            AuditEventType.LoginFailure,
            AuditCategory.Authentication,
            "Login failed",
            severity: AuditSeverity.Warning,
            success: false,
            errorMessage: "Invalid credentials");

        // Assert
        auditEvent.Success.Should().BeFalse();
        auditEvent.ErrorMessage.Should().Be("Invalid credentials");
        auditEvent.Severity.Should().Be(AuditSeverity.Warning);
    }

    [Fact]
    public void Create_ShouldGenerateNewId()
    {
        // Act
        var auditEvent = AuditEvent.Create(
            AuditEventType.LoginSuccess,
            AuditCategory.Authentication,
            "Test");

        // Assert
        auditEvent.Id.Should().NotBe(Guid.Empty);
    }

    #endregion

    #region Factory Method Tests - LoginSuccess

    [Fact]
    public void LoginSuccess_ShouldCreateCorrectEvent()
    {
        // Act
        var auditEvent = AuditEvent.LoginSuccess(
            "user-123",
            "max@example.com",
            "192.168.1.1",
            "Mozilla/5.0");

        // Assert
        auditEvent.EventType.Should().Be(AuditEventType.LoginSuccess);
        auditEvent.Category.Should().Be(AuditCategory.Authentication);
        auditEvent.UserId.Should().Be("user-123");
        auditEvent.UserName.Should().Be("max@example.com");
        auditEvent.IpAddress.Should().Be("192.168.1.1");
        auditEvent.UserAgent.Should().Be("Mozilla/5.0");
        auditEvent.Success.Should().BeTrue();
        auditEvent.Action.Should().Contain("logged in successfully");
    }

    #endregion

    #region Factory Method Tests - LoginFailure

    [Fact]
    public void LoginFailure_ShouldCreateCorrectEvent()
    {
        // Act
        var auditEvent = AuditEvent.LoginFailure(
            "max@example.com",
            "Invalid password",
            "192.168.1.1",
            "Mozilla/5.0");

        // Assert
        auditEvent.EventType.Should().Be(AuditEventType.LoginFailure);
        auditEvent.Category.Should().Be(AuditCategory.Authentication);
        auditEvent.UserName.Should().Be("max@example.com");
        auditEvent.Severity.Should().Be(AuditSeverity.Warning);
        auditEvent.Success.Should().BeFalse();
        auditEvent.ErrorMessage.Should().Be("Invalid password");
        auditEvent.Action.Should().Contain("Login failed");
    }

    [Fact]
    public void LoginFailure_WithNullUserName_ShouldUseUnknownUser()
    {
        // Act
        var auditEvent = AuditEvent.LoginFailure(
            null,
            "Invalid credentials");

        // Assert
        auditEvent.Action.Should().Contain("unknown user");
    }

    #endregion

    #region Factory Method Tests - MemberCreated

    [Fact]
    public void MemberCreated_ShouldCreateCorrectEvent()
    {
        // Act
        var auditEvent = AuditEvent.MemberCreated(
            "member-123",
            "Max Mustermann",
            "user-456",
            "admin@example.com",
            "{\"email\": \"max@example.com\"}");

        // Assert
        auditEvent.EventType.Should().Be(AuditEventType.MemberCreated);
        auditEvent.Category.Should().Be(AuditCategory.MemberManagement);
        auditEvent.EntityType.Should().Be("Member");
        auditEvent.EntityId.Should().Be("member-123");
        auditEvent.UserId.Should().Be("user-456");
        auditEvent.UserName.Should().Be("admin@example.com");
        auditEvent.Details.Should().Be("{\"email\": \"max@example.com\"}");
        auditEvent.Action.Should().Contain("Max Mustermann").And.Contain("created");
    }

    #endregion

    #region Factory Method Tests - MemberUpdated

    [Fact]
    public void MemberUpdated_ShouldCreateCorrectEvent()
    {
        // Act
        var auditEvent = AuditEvent.MemberUpdated(
            "member-123",
            "Max Mustermann",
            "user-456",
            "admin@example.com",
            "{\"changed\": [\"email\"]}");

        // Assert
        auditEvent.EventType.Should().Be(AuditEventType.MemberUpdated);
        auditEvent.Category.Should().Be(AuditCategory.MemberManagement);
        auditEvent.EntityType.Should().Be("Member");
        auditEvent.EntityId.Should().Be("member-123");
        auditEvent.Action.Should().Contain("Max Mustermann").And.Contain("updated");
    }

    #endregion

    #region Factory Method Tests - DataExported

    [Fact]
    public void DataExported_ShouldCreateCorrectEvent()
    {
        // Act
        var auditEvent = AuditEvent.DataExported(
            "Member",
            "user-123",
            "admin@example.com",
            150);

        // Assert
        auditEvent.EventType.Should().Be(AuditEventType.DataExported);
        auditEvent.Category.Should().Be(AuditCategory.DataAccess);
        auditEvent.EntityType.Should().Be("Member");
        auditEvent.Action.Should().Contain("150").And.Contain("Member");
        auditEvent.Details.Should().Contain("150");
    }

    #endregion

    #region AnonymizeUser Tests

    [Fact]
    public void AnonymizeUser_ShouldAnonymizePersonalData()
    {
        // Arrange
        var auditEvent = AuditEvent.LoginSuccess(
            "user-123",
            "max@example.com",
            "192.168.1.1",
            "Mozilla/5.0");

        // Act
        auditEvent.AnonymizeUser();

        // Assert
        auditEvent.UserId.Should().Be("anonymized");
        auditEvent.UserName.Should().Be("anonymized");
        auditEvent.IpAddress.Should().BeNull();
        auditEvent.UserAgent.Should().BeNull();
    }

    [Fact]
    public void AnonymizeUser_WithCustomValue_ShouldUseCustomValue()
    {
        // Arrange
        var auditEvent = AuditEvent.LoginSuccess(
            "user-123",
            "max@example.com");

        // Act
        auditEvent.AnonymizeUser("deleted-user");

        // Assert
        auditEvent.UserId.Should().Be("deleted-user");
        auditEvent.UserName.Should().Be("deleted-user");
    }

    #endregion

    #region EventType and Category Tests

    [Theory]
    [InlineData(AuditEventType.LoginSuccess, AuditCategory.Authentication)]
    [InlineData(AuditEventType.LoginFailure, AuditCategory.Authentication)]
    [InlineData(AuditEventType.MemberCreated, AuditCategory.MemberManagement)]
    [InlineData(AuditEventType.MemberUpdated, AuditCategory.MemberManagement)]
    [InlineData(AuditEventType.DataExported, AuditCategory.DataAccess)]
    public void Create_WithDifferentTypesAndCategories_ShouldSetCorrectly(
        AuditEventType eventType,
        AuditCategory category)
    {
        // Act
        var auditEvent = AuditEvent.Create(eventType, category, "Test action");

        // Assert
        auditEvent.EventType.Should().Be(eventType);
        auditEvent.Category.Should().Be(category);
    }

    [Theory]
    [InlineData(AuditSeverity.Info)]
    [InlineData(AuditSeverity.Warning)]
    [InlineData(AuditSeverity.Critical)]
    public void Create_WithDifferentSeverities_ShouldSetCorrectly(AuditSeverity severity)
    {
        // Act
        var auditEvent = AuditEvent.Create(
            AuditEventType.LoginSuccess,
            AuditCategory.Authentication,
            "Test",
            severity: severity);

        // Assert
        auditEvent.Severity.Should().Be(severity);
    }

    #endregion
}
