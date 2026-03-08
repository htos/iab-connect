using FluentAssertions;
using IabConnect.Domain.Members;
using Xunit;

namespace IabConnect.Application.Tests.Members;

/// <summary>
/// Unit tests for MemberSegment aggregate root
/// REQ-017: Segmentierung &amp; Verteiler
/// </summary>
public class MemberSegmentTests
{
    #region Create Tests

    [Fact]
    public void Create_StaticSegment_ShouldSetAllProperties()
    {
        // Act
        var segment = MemberSegment.Create(
            "Active Members",
            SegmentType.Static,
            "All active members",
            null,
            "orange");

        // Assert
        segment.Name.Should().Be("Active Members");
        segment.SegmentType.Should().Be(SegmentType.Static);
        segment.Description.Should().Be("All active members");
        segment.CriteriaJson.Should().BeNull();
        segment.Color.Should().Be("orange");
        segment.IsActive.Should().BeTrue();
        segment.Assignments.Should().BeEmpty();
    }

    [Fact]
    public void Create_DynamicSegment_ShouldSetCriteriaJson()
    {
        var criteria = """{"status":["Active"],"type":["Regular"]}""";

        var segment = MemberSegment.Create(
            "Regular Active",
            SegmentType.Dynamic,
            "Dynamic segment",
            criteria,
            "blue");

        segment.SegmentType.Should().Be(SegmentType.Dynamic);
        segment.CriteriaJson.Should().Be(criteria);
    }

    [Fact]
    public void Create_NewSegment_ShouldRaiseMemberSegmentCreatedEvent()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);

        segment.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MemberSegmentCreatedEvent>();
    }

    [Fact]
    public void Create_NewSegment_ShouldRaiseEventWithCorrectData()
    {
        var segment = MemberSegment.Create("Newsletter", SegmentType.Dynamic);

        var @event = segment.DomainEvents.Should().ContainSingle()
            .Which.Should().BeOfType<MemberSegmentCreatedEvent>().Subject;

        @event.SegmentId.Should().Be(segment.Id);
        @event.Name.Should().Be("Newsletter");
        @event.SegmentType.Should().Be(SegmentType.Dynamic);
    }

    [Theory]
    [InlineData(SegmentType.Static)]
    [InlineData(SegmentType.Dynamic)]
    public void Create_WithDifferentTypes_ShouldSetCorrectType(SegmentType type)
    {
        var segment = MemberSegment.Create("Segment", type);
        segment.SegmentType.Should().Be(type);
    }

    [Fact]
    public void Create_WithOptionalParamsOmitted_ShouldUseDefaults()
    {
        var segment = MemberSegment.Create("Minimal", SegmentType.Static);

        segment.Description.Should().BeNull();
        segment.CriteriaJson.Should().BeNull();
        segment.Color.Should().BeNull();
        segment.IsActive.Should().BeTrue();
    }

    #endregion

    #region Update Tests

    [Fact]
    public void Update_ShouldChangeProperties()
    {
        var segment = MemberSegment.Create("Old Name", SegmentType.Static, "Old desc", null, "orange");

        segment.Update("New Name", "New desc", null, "blue");

        segment.Name.Should().Be("New Name");
        segment.Description.Should().Be("New desc");
        segment.Color.Should().Be("blue");
    }

    [Fact]
    public void Update_DynamicSegment_ShouldUpdateCriteria()
    {
        var segment = MemberSegment.Create("Dynamic", SegmentType.Dynamic, null, """{"status":["Active"]}""");

        segment.Update("Dynamic", null, """{"status":["Inactive"]}""", "green");

        segment.CriteriaJson.Should().Be("""{"status":["Inactive"]}""");
    }

    #endregion

    #region Activate / Deactivate Tests

    [Fact]
    public void Deactivate_ActiveSegment_ShouldSetInactive()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);

        segment.Deactivate();

        segment.IsActive.Should().BeFalse();
    }

    [Fact]
    public void Activate_InactiveSegment_ShouldSetActive()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);
        segment.Deactivate();

        segment.Activate();

        segment.IsActive.Should().BeTrue();
    }

    #endregion

    #region AddMember Tests

    [Fact]
    public void AddMember_StaticSegment_ShouldAddAssignment()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);
        var memberId = Guid.NewGuid();

        segment.AddMember(memberId);

        segment.Assignments.Should().ContainSingle()
            .Which.MemberId.Should().Be(memberId);
    }

    [Fact]
    public void AddMember_DuplicateMember_ShouldNotAddTwice()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);
        var memberId = Guid.NewGuid();

        segment.AddMember(memberId);
        segment.AddMember(memberId);

        segment.Assignments.Should().HaveCount(1);
    }

    [Fact]
    public void AddMember_MultipleMembers_ShouldAddAll()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);
        var member1 = Guid.NewGuid();
        var member2 = Guid.NewGuid();

        segment.AddMember(member1);
        segment.AddMember(member2);

        segment.Assignments.Should().HaveCount(2);
    }

    [Fact]
    public void AddMember_DynamicSegment_ShouldThrow()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Dynamic);

        var act = () => segment.AddMember(Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*static*");
    }

    #endregion

    #region RemoveMember Tests

    [Fact]
    public void RemoveMember_ExistingMember_ShouldRemoveAssignment()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);
        var memberId = Guid.NewGuid();
        segment.AddMember(memberId);

        segment.RemoveMember(memberId);

        segment.Assignments.Should().BeEmpty();
    }

    [Fact]
    public void RemoveMember_NonExistentMember_ShouldDoNothing()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Static);

        segment.RemoveMember(Guid.NewGuid());

        segment.Assignments.Should().BeEmpty();
    }

    [Fact]
    public void RemoveMember_DynamicSegment_ShouldThrow()
    {
        var segment = MemberSegment.Create("Test", SegmentType.Dynamic);

        var act = () => segment.RemoveMember(Guid.NewGuid());

        act.Should().Throw<InvalidOperationException>()
            .WithMessage("*static*");
    }

    #endregion
}
