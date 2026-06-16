using FluentAssertions;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;
using Xunit;

namespace IabConnect.Application.Tests.Communication.Automations;

/// <summary>
/// REQ-028 (E5-S1) AC-1/AC-2: domain unit tests for the <see cref="AutomationDefinition"/> guarded
/// status machine and the <see cref="AutomationTrigger"/> parameter invariants.
/// </summary>
public sealed class AutomationDefinitionTests
{
    private static AutomationDefinition NewDraft(AutomationTriggerType type = AutomationTriggerType.MemberJoined, int? offset = null)
        => AutomationDefinition.Create(
            "Welcome journey", "desc", templateId: 1,
            AutomationTrigger.Create(type, offset),
            RecipientSegmentType.AllActiveMembers, segmentFilter: null, consentFilter: null,
            createdById: Guid.NewGuid(), createdByName: "tester");

    [Fact]
    public void Create_StartsInDraft()
    {
        var d = NewDraft();
        d.Status.Should().Be(AutomationStatus.Draft);
        d.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(5));
    }

    [Fact]
    public void Activate_FromDraft_BecomesActive()
    {
        var d = NewDraft();
        d.Activate();
        d.Status.Should().Be(AutomationStatus.Active);
    }

    [Fact]
    public void Pause_Resume_RoundTrips()
    {
        var d = NewDraft();
        d.Activate();
        d.Pause();
        d.Status.Should().Be(AutomationStatus.Paused);
        d.Resume();
        d.Status.Should().Be(AutomationStatus.Active);
    }

    [Fact]
    public void Disable_ThenActivate_ReEnables()
    {
        var d = NewDraft();
        d.Activate();
        d.Disable();
        d.Status.Should().Be(AutomationStatus.Disabled);
        d.Activate();
        d.Status.Should().Be(AutomationStatus.Active);
    }

    [Fact]
    public void Pause_WhenNotActive_Throws()
    {
        var d = NewDraft(); // Draft
        var act = () => d.Pause();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Resume_WhenNotPaused_Throws()
    {
        var d = NewDraft();
        d.Activate();
        var act = () => d.Resume(); // Active, not Paused
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Activate_WhenActive_Throws()
    {
        var d = NewDraft();
        d.Activate();
        var act = () => d.Activate();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Disable_WhenAlreadyDisabled_Throws()
    {
        var d = NewDraft();
        d.Disable();
        var act = () => d.Disable();
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Update_WhenActive_Throws_MustPauseFirst()
    {
        var d = NewDraft();
        d.Activate();
        var act = () => d.Update("new", null, 2,
            AutomationTrigger.Create(AutomationTriggerType.MemberJoined, null),
            RecipientSegmentType.AllActiveMembers, null, null);
        act.Should().Throw<InvalidOperationException>();
    }

    [Fact]
    public void Update_WhenPaused_AppliesChanges()
    {
        var d = NewDraft();
        d.Activate();
        d.Pause();
        d.Update("Renamed", "newdesc", 7,
            AutomationTrigger.Create(AutomationTriggerType.EventUpcoming, 3),
            RecipientSegmentType.NewsletterSubscribers, null, ConsentType.Newsletter);

        d.Name.Should().Be("Renamed");
        d.TemplateId.Should().Be(7);
        d.Trigger.Type.Should().Be(AutomationTriggerType.EventUpcoming);
        d.Trigger.OffsetDays.Should().Be(3);
        d.SegmentType.Should().Be(RecipientSegmentType.NewsletterSubscribers);
        d.ConsentFilter.Should().Be(ConsentType.Newsletter);
    }

    [Theory]
    [InlineData(AutomationTriggerType.EventUpcoming)]
    [InlineData(AutomationTriggerType.MembershipRenewalDue)]
    public void Trigger_TimeRelative_RequiresNonNegativeOffset(AutomationTriggerType type)
    {
        var missing = () => AutomationTrigger.Create(type, null);
        missing.Should().Throw<ArgumentException>();

        var negative = () => AutomationTrigger.Create(type, -1);
        negative.Should().Throw<ArgumentException>();

        AutomationTrigger.Create(type, 0).OffsetDays.Should().Be(0);
        AutomationTrigger.Create(type, 7).OffsetDays.Should().Be(7);
    }

    [Theory]
    [InlineData(AutomationTriggerType.MemberJoined)]
    [InlineData(AutomationTriggerType.Manual)]
    [InlineData(AutomationTriggerType.Scheduled)]
    public void Trigger_NonTimeRelative_DropsOffset(AutomationTriggerType type)
    {
        var t = AutomationTrigger.Create(type, 99);
        t.OffsetDays.Should().BeNull("non-time-relative triggers carry no offset");
        t.IsTimeRelative().Should().BeFalse();
    }
}
