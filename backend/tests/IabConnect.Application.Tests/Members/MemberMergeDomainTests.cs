using FluentAssertions;
using IabConnect.Application.Members;
using IabConnect.Domain.Members;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// REQ-018 (E2.S3): domain-level unit tests for the merge primitives that don't need a DB.
/// Full transactional behavior is covered by <c>MemberMergeIntegrationTests</c> with Testcontainers.
/// </summary>
public sealed class MemberMergeDomainTests
{
    [Fact]
    public void MarkMergedInto_SetsMergedFlagAndDeactivates()
    {
        var source = NewMember();
        var targetId = Guid.NewGuid();
        var adminId = Guid.NewGuid();

        source.MarkMergedInto(targetId, adminId);

        source.MergedIntoMemberId.Should().Be(targetId);
        source.Status.Should().Be(MembershipStatus.Inactive);
        source.DomainEvents.Should().ContainSingle(e => e is MemberMergedIntoEvent);
    }

    [Fact]
    public void MarkMergedInto_RejectsEmptyTargetGuid()
    {
        var source = NewMember();

        var act = () => source.MarkMergedInto(Guid.Empty, Guid.NewGuid());

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void MarkMergedInto_RejectsSelfMerge()
    {
        var source = NewMember();

        var act = () => source.MarkMergedInto(source.Id, Guid.NewGuid());

        act.Should().Throw<ArgumentException>();
    }

    [Fact]
    public void MarkMergedInto_IsIdempotent_KeepsFirstTarget()
    {
        var source = NewMember();
        var firstTarget = Guid.NewGuid();
        var secondTarget = Guid.NewGuid();

        source.MarkMergedInto(firstTarget, Guid.NewGuid());
        source.MarkMergedInto(secondTarget, Guid.NewGuid());

        source.MergedIntoMemberId.Should().Be(firstTarget);
    }

    [Fact]
    public void ClearKeycloakLink_NullsTheLink()
    {
        var source = NewMember();
        source.LinkToKeycloak(Guid.NewGuid());
        source.KeycloakUserId.Should().NotBeNull();

        source.ClearKeycloakLink();

        source.KeycloakUserId.Should().BeNull();
    }

    [Fact]
    public void UnsafeMergeException_ExposesReasonsListVerbatim()
    {
        var reasons = new[] { "Source has 3 sent invoices", "Source has 1 approved expense claim" };

        var ex = new UnsafeMergeException(reasons);

        ex.Reasons.Should().BeEquivalentTo(reasons);
        ex.Message.Should().Contain("3 sent invoices");
        ex.Message.Should().Contain("1 approved expense claim");
    }

    private static Member NewMember()
    {
        return Member.Create(
            "Test",
            "Member",
            $"{Guid.NewGuid()}@example.com",
            Address.Create("Street 1", "Bern", "3000", "Schweiz"),
            MembershipType.Regular,
            phone: null);
    }
}
