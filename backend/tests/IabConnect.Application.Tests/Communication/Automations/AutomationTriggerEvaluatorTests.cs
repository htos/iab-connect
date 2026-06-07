using FluentAssertions;
using IabConnect.Application.Communication.Automations;
using IabConnect.Domain.Communication;
using Xunit;

namespace IabConnect.Application.Tests.Communication.Automations;

/// <summary>
/// REQ-028 (E5-S2) AC-7: per-trigger-type evaluator unit tests — each type computes the correct
/// "due now" occurrences + deterministic idempotency keys; offset arithmetic for time-relative
/// triggers; Manual never auto-fires.
/// </summary>
public sealed class AutomationTriggerEvaluatorTests
{
    private readonly AutomationTriggerEvaluator _sut = new();
    private static readonly DateTime Now = new(2026, 6, 6, 10, 0, 0, DateTimeKind.Utc);

    private static AutomationDefinition Def(AutomationTriggerType type, int? offset = null)
        => AutomationDefinition.Create(
            "J", null, 1, AutomationTrigger.Create(type, offset),
            RecipientSegmentType.AllActiveMembers, null, null, Guid.NewGuid(), "tester");

    private static ResolvedRecipient Rec(Guid? userId = null) =>
        new(userId ?? Guid.NewGuid(), Guid.NewGuid(), "a@example.com", "Asha", "Patel");

    [Fact]
    public void MemberJoined_OncePerRecipient_KeyHasNoDate()
    {
        var def = Def(AutomationTriggerType.MemberJoined);
        var user = Guid.NewGuid();
        var occ = _sut.ComputeDueOccurrences(def, [Rec(user)], Now);

        occ.Should().ContainSingle();
        occ[0].IdempotencyKey.Should().Be($"{def.Id}|MemberJoined|{user}");
    }

    [Fact]
    public void Scheduled_OncePerRunDay_KeyHasDate()
    {
        var def = Def(AutomationTriggerType.Scheduled);
        var user = Guid.NewGuid();
        var occ = _sut.ComputeDueOccurrences(def, [Rec(user)], Now);

        occ[0].IdempotencyKey.Should().Be($"{def.Id}|Scheduled|{user}|2026-06-06");
    }

    [Fact]
    public void EventUpcoming_FiresOnceEverPerRecipient_KeyHasNoDate()
    {
        var def = Def(AutomationTriggerType.EventUpcoming, offset: 7);
        var user = Guid.NewGuid();
        // The key must NOT embed a date — otherwise an Active definition re-sends every day.
        var k1 = _sut.ComputeDueOccurrences(def, [Rec(user)], Now)[0].IdempotencyKey;
        var k2 = _sut.ComputeDueOccurrences(def, [Rec(user)], Now.AddDays(1))[0].IdempotencyKey;

        k1.Should().Be($"{def.Id}|EventUpcoming|{user}");
        k2.Should().Be(k1, "a time-relative trigger fires once ever per recipient — never a daily resend");
    }

    [Fact]
    public void MembershipRenewalDue_FiresOnceEverPerRecipient_KeyHasNoDate()
    {
        var def = Def(AutomationTriggerType.MembershipRenewalDue, offset: 0);
        var user = Guid.NewGuid();
        var k1 = _sut.ComputeDueOccurrences(def, [Rec(user)], Now)[0].IdempotencyKey;
        var k2 = _sut.ComputeDueOccurrences(def, [Rec(user)], Now.AddDays(5))[0].IdempotencyKey;

        k1.Should().Be($"{def.Id}|MembershipRenewalDue|{user}");
        k2.Should().Be(k1, "never a daily resend");
    }

    [Fact]
    public void Manual_NeverAutoFires()
    {
        var def = Def(AutomationTriggerType.Manual);
        var occ = _sut.ComputeDueOccurrences(def, [Rec(), Rec()], Now);
        occ.Should().BeEmpty();
    }

    [Fact]
    public void MultipleRecipients_EachGetsAnOccurrence()
    {
        var def = Def(AutomationTriggerType.MemberJoined);
        var occ = _sut.ComputeDueOccurrences(def, [Rec(), Rec(), Rec()], Now);
        occ.Should().HaveCount(3);
        occ.Select(o => o.IdempotencyKey).Should().OnlyHaveUniqueItems();
    }

    [Fact]
    public void SameRecipientSameDay_ProducesStableKey_AcrossRuns()
    {
        var def = Def(AutomationTriggerType.MemberJoined);
        var r = Rec();
        var k1 = _sut.ComputeDueOccurrences(def, [r], Now)[0].IdempotencyKey;
        var k2 = _sut.ComputeDueOccurrences(def, [r], Now.AddHours(3))[0].IdempotencyKey;
        k2.Should().Be(k1, "MemberJoined fires once ever — the key must not vary by run time");
    }
}
