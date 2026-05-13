using FluentAssertions;
using IabConnect.Application.Members.Commands;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018 (E2.S3): syntactic validator coverage for <see cref="MergeMembersCommand"/>.
/// Domain blockers (invoice/expense status, Keycloak conflict, soft-retire) live in the service
/// layer and are covered by <c>MemberMergeIntegrationTests</c>.
/// </summary>
public sealed class MergeMembersCommandValidatorTests
{
    private readonly MergeMembersCommandValidator _validator = new();

    private static MergeMembersCommand BuildValid() => new(
        SourceId: Guid.NewGuid(),
        TargetId: Guid.NewGuid(),
        Reason: "Removing duplicate",
        ConfirmFinanceImpact: false,
        ConfirmKeycloakImpact: false,
        AdminUserId: Guid.NewGuid(),
        AdminUserName: "admin@example.com");

    [Fact]
    public void Validate_ValidCommand_Passes()
    {
        var result = _validator.Validate(BuildValid());
        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public void Validate_EmptySourceId_Fails()
    {
        var cmd = BuildValid() with { SourceId = Guid.Empty };
        _validator.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmptyTargetId_Fails()
    {
        var cmd = BuildValid() with { TargetId = Guid.Empty };
        _validator.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_SameSourceAndTarget_Fails()
    {
        var id = Guid.NewGuid();
        var cmd = BuildValid() with { SourceId = id, TargetId = id };
        _validator.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmptyReason_Fails()
    {
        var cmd = BuildValid() with { Reason = string.Empty };
        _validator.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_ReasonOver500Chars_Fails()
    {
        var cmd = BuildValid() with { Reason = new string('x', 501) };
        _validator.Validate(cmd).IsValid.Should().BeFalse();
    }

    [Fact]
    public void Validate_EmptyAdminUserId_Fails()
    {
        var cmd = BuildValid() with { AdminUserId = Guid.Empty };
        _validator.Validate(cmd).IsValid.Should().BeFalse();
    }
}
