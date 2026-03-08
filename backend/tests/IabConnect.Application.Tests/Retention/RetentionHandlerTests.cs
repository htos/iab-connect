using FluentAssertions;
using IabConnect.Application.Retention;
using IabConnect.Domain.Operations;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Retention;

/// <summary>
/// REQ-057: Unit tests for retention policy handlers and domain model.
/// </summary>
public class RetentionHandlerTests
{
    private readonly Mock<IRetentionPolicyService> _policyServiceMock = new();
    private readonly Mock<IRetentionEnforcementService> _enforcementServiceMock = new();

    // --- Domain Entity Tests ---

    [Fact]
    public void RetentionPolicy_Create_ShouldSetDefaults()
    {
        var policy = RetentionPolicy.Create(
            DataCategories.AuditLogs,
            "Audit Logs",
            24,
            RetentionAction.Anonymize,
            "DSGVO Art. 5(1)(e)");

        policy.Id.Should().NotBeEmpty();
        policy.DataCategory.Should().Be(DataCategories.AuditLogs);
        policy.DisplayName.Should().Be("Audit Logs");
        policy.RetentionMonths.Should().Be(24);
        policy.Action.Should().Be(RetentionAction.Anonymize);
        policy.LegalBasis.Should().Be("DSGVO Art. 5(1)(e)");
        policy.IsActive.Should().BeTrue();
        policy.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void RetentionPolicy_Create_WithInvalidMonths_ShouldThrow()
    {
        var act = () => RetentionPolicy.Create(
            DataCategories.AuditLogs,
            "Test",
            0,
            RetentionAction.Delete);

        act.Should().Throw<ArgumentException>()
            .WithParameterName("retentionMonths");
    }

    [Fact]
    public void RetentionPolicy_Update_ShouldModifyFields()
    {
        var policy = RetentionPolicy.Create(
            DataCategories.Backups,
            "Backups",
            6,
            RetentionAction.Delete);

        policy.Update("Backups updated", 12, RetentionAction.Archive, "New basis");

        policy.DisplayName.Should().Be("Backups updated");
        policy.RetentionMonths.Should().Be(12);
        policy.Action.Should().Be(RetentionAction.Archive);
        policy.LegalBasis.Should().Be("New basis");
        policy.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void RetentionPolicy_Deactivate_ShouldSetInactive()
    {
        var policy = RetentionPolicy.Create(
            DataCategories.Events,
            "Events",
            48,
            RetentionAction.Archive);

        policy.Deactivate();

        policy.IsActive.Should().BeFalse();
        policy.UpdatedAt.Should().NotBeNull();
    }

    [Fact]
    public void RetentionPolicy_Activate_ShouldSetActive()
    {
        var policy = RetentionPolicy.Create(
            DataCategories.Events,
            "Events",
            48,
            RetentionAction.Archive);

        policy.Deactivate();
        policy.Activate();

        policy.IsActive.Should().BeTrue();
    }

    // --- Handler Tests ---

    [Fact]
    public async Task GetRetentionPolicies_ShouldReturnDtoList()
    {
        var policies = new List<RetentionPolicy>
        {
            RetentionPolicy.Create(DataCategories.AuditLogs, "Audit", 24, RetentionAction.Anonymize),
            RetentionPolicy.Create(DataCategories.Backups, "Backups", 6, RetentionAction.Delete),
        };

        _policyServiceMock.Setup(s => s.GetAllPoliciesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(policies);

        var handler = new GetRetentionPoliciesQueryHandler(_policyServiceMock.Object);
        var result = await handler.Handle(new GetRetentionPoliciesQuery(), CancellationToken.None);

        result.Should().HaveCount(2);
        result[0].DataCategory.Should().Be(DataCategories.AuditLogs);
        result[0].Action.Should().Be("Anonymize");
        result[1].DataCategory.Should().Be(DataCategories.Backups);
    }

    [Fact]
    public async Task GetRetentionPolicyById_Found_ShouldReturnDto()
    {
        var policy = RetentionPolicy.Create(
            DataCategories.FinanceData,
            "Finance",
            120,
            RetentionAction.Archive,
            "OR Art. 958f");

        _policyServiceMock.Setup(s => s.GetPolicyByIdAsync(policy.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(policy);

        var handler = new GetRetentionPolicyByIdQueryHandler(_policyServiceMock.Object);
        var result = await handler.Handle(new GetRetentionPolicyByIdQuery(policy.Id), CancellationToken.None);

        result.Should().NotBeNull();
        result!.RetentionMonths.Should().Be(120);
        result.Action.Should().Be("Archive");
        result.LegalBasis.Should().Be("OR Art. 958f");
    }

    [Fact]
    public async Task GetRetentionPolicyById_NotFound_ShouldReturnNull()
    {
        _policyServiceMock.Setup(s => s.GetPolicyByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((RetentionPolicy?)null);

        var handler = new GetRetentionPolicyByIdQueryHandler(_policyServiceMock.Object);
        var result = await handler.Handle(new GetRetentionPolicyByIdQuery(Guid.NewGuid()), CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task UpdateRetentionPolicy_Found_ShouldUpdateAndReturn()
    {
        var policy = RetentionPolicy.Create(
            DataCategories.Documents,
            "Documents",
            60,
            RetentionAction.Archive);

        _policyServiceMock.Setup(s => s.GetPolicyByIdAsync(policy.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(policy);
        _policyServiceMock.Setup(s => s.UpdatePolicyAsync(policy, It.IsAny<CancellationToken>()))
            .ReturnsAsync(policy);

        var handler = new UpdateRetentionPolicyCommandHandler(_policyServiceMock.Object);
        var result = await handler.Handle(
            new UpdateRetentionPolicyCommand(policy.Id, "Docs updated", 36, "Delete", "New basis", false),
            CancellationToken.None);

        result.Should().NotBeNull();
        result!.DisplayName.Should().Be("Docs updated");
        result.RetentionMonths.Should().Be(36);
        result.Action.Should().Be("Delete");
        result.IsActive.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateRetentionPolicy_NotFound_ShouldReturnNull()
    {
        _policyServiceMock.Setup(s => s.GetPolicyByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((RetentionPolicy?)null);

        var handler = new UpdateRetentionPolicyCommandHandler(_policyServiceMock.Object);
        var result = await handler.Handle(
            new UpdateRetentionPolicyCommand(Guid.NewGuid(), "X", 12, "Delete", null, true),
            CancellationToken.None);

        result.Should().BeNull();
    }

    [Fact]
    public async Task EnforceRetention_ShouldReturnProcessedCount()
    {
        _enforcementServiceMock.Setup(s => s.EnforceAllPoliciesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(42);

        var handler = new EnforceRetentionCommandHandler(_enforcementServiceMock.Object);
        var result = await handler.Handle(new EnforceRetentionCommand(), CancellationToken.None);

        result.Should().Be(42);
    }
}
