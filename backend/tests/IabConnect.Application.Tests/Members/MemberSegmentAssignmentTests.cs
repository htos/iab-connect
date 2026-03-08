using FluentAssertions;
using IabConnect.Domain.Members;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// Unit tests for MemberSegmentAssignment entity
/// REQ-017: Segmentierung &amp; Verteiler
/// </summary>
public class MemberSegmentAssignmentTests
{
    [Fact]
    public void Create_ShouldSetAllProperties()
    {
        var segmentId = Guid.NewGuid();
        var memberId = Guid.NewGuid();

        var assignment = MemberSegmentAssignment.Create(segmentId, memberId);

        assignment.SegmentId.Should().Be(segmentId);
        assignment.MemberId.Should().Be(memberId);
        assignment.AssignedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
        assignment.Id.Should().NotBeEmpty();
    }

    [Fact]
    public void Create_MultipleAssignments_ShouldHaveUniqueIds()
    {
        var segmentId = Guid.NewGuid();

        var a1 = MemberSegmentAssignment.Create(segmentId, Guid.NewGuid());
        var a2 = MemberSegmentAssignment.Create(segmentId, Guid.NewGuid());

        a1.Id.Should().NotBe(a2.Id);
    }
}
