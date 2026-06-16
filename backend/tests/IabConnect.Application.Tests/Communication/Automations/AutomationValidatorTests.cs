using FluentAssertions;
using FluentValidation.TestHelper;
using IabConnect.Application.Communication;
using IabConnect.Application.Communication.Automations.Commands;
using IabConnect.Domain.Communication;
using IabConnect.Domain.Members;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Communication.Automations;

/// <summary>
/// REQ-028 (E5-S1) AC-4: validator rules for the create command. Each invalid case yields the
/// expected per-field error; the valid baseline passes.
/// </summary>
public sealed class AutomationValidatorTests
{
    private readonly Mock<IEmailTemplateRepository> _templates = new();
    private readonly Mock<IMemberSegmentRepository> _segments = new();
    private readonly CreateAutomationCommandValidator _sut;

    public AutomationValidatorTests()
    {
        // Default: template id 1 is active; segment id resolves.
        _templates.Setup(t => t.GetByIdAsync(1))
            .ReturnsAsync(EmailTemplate.Create("Welcome", "Subj", "<p>hi</p>", "hi", "Onboarding"));
        _segments.Setup(s => s.ExistsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _sut = new CreateAutomationCommandValidator(_templates.Object, _segments.Object);
    }

    private Task<TestValidationResult<CreateAutomationCommand>> Validate(CreateAutomationCommand cmd)
        => _sut.TestValidateAsync(cmd, cancellationToken: TestContext.Current.CancellationToken);

    private static CreateAutomationCommand Valid() => new()
    {
        Name = "Welcome journey",
        TemplateId = 1,
        TriggerType = AutomationTriggerType.MemberJoined,
        OffsetDays = null,
        SegmentType = RecipientSegmentType.AllActiveMembers,
        CreatedById = Guid.NewGuid(),
        CreatedByName = "tester"
    };

    [Fact]
    public async Task Valid_Passes()
    {
        var result = await Validate(Valid());
        result.ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public async Task EmptyName_Fails()
    {
        var result = await Validate(Valid() with { Name = "" });
        result.ShouldHaveValidationErrorFor("Name");
    }

    [Fact]
    public async Task OverlongName_Fails()
    {
        var result = await Validate(Valid() with { Name = new string('x', 201) });
        result.ShouldHaveValidationErrorFor("Name");
    }

    [Fact]
    public async Task UnknownTemplate_Fails()
    {
        _templates.Setup(t => t.GetByIdAsync(999)).ReturnsAsync((EmailTemplate?)null);
        var result = await Validate(Valid() with { TemplateId = 999 });
        result.ShouldHaveValidationErrorFor("TemplateId");
    }

    [Fact]
    public async Task InactiveTemplate_Fails()
    {
        var inactive = EmailTemplate.Create("Old", "S", "<p>x</p>", "x", "Cat");
        inactive.IsActive = false;
        _templates.Setup(t => t.GetByIdAsync(5)).ReturnsAsync(inactive);
        var result = await Validate(Valid() with { TemplateId = 5 });
        result.ShouldHaveValidationErrorFor("TemplateId");
    }

    [Fact]
    public async Task TimeRelativeTrigger_WithoutOffset_Fails()
    {
        var result = await Validate(
            Valid() with { TriggerType = AutomationTriggerType.EventUpcoming, OffsetDays = null });
        result.ShouldHaveValidationErrorFor("OffsetDays");
    }

    [Fact]
    public async Task TimeRelativeTrigger_WithNegativeOffset_Fails()
    {
        var result = await Validate(
            Valid() with { TriggerType = AutomationTriggerType.MembershipRenewalDue, OffsetDays = -3 });
        result.ShouldHaveValidationErrorFor("OffsetDays");
    }

    [Fact]
    public async Task TimeRelativeTrigger_WithValidOffset_Passes()
    {
        var result = await Validate(
            Valid() with { TriggerType = AutomationTriggerType.EventUpcoming, OffsetDays = 7 });
        result.ShouldNotHaveValidationErrorFor("OffsetDays");
    }

    [Fact]
    public async Task MemberSegment_WithMissingSegment_Fails()
    {
        _segments.Setup(s => s.ExistsAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);
        var result = await Validate(Valid() with
        {
            SegmentType = RecipientSegmentType.MemberSegment,
            SegmentFilter = Guid.NewGuid().ToString()
        });
        result.ShouldHaveValidationErrorFor("SegmentFilter");
    }

    [Fact]
    public async Task MemberSegment_WithNonGuidFilter_Fails()
    {
        var result = await Validate(Valid() with
        {
            SegmentType = RecipientSegmentType.MemberSegment,
            SegmentFilter = "not-a-guid"
        });
        result.ShouldHaveValidationErrorFor("SegmentFilter");
    }

    [Fact]
    public async Task MemberSegment_WithResolvingSegment_Passes()
    {
        var result = await Validate(Valid() with
        {
            SegmentType = RecipientSegmentType.MemberSegment,
            SegmentFilter = Guid.NewGuid().ToString()
        });
        result.ShouldNotHaveValidationErrorFor("SegmentFilter");
    }
}
