using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Communication;
using IabConnect.Application.Communication.Automations.Commands;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Communication;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.Communication.Automations;

/// <summary>
/// REQ-028 (E5-S1) AC-1/AC-5: handler tests for the create + lifecycle commands — correct state
/// transition + audit write (Moq for repo/template/audit boundaries, mirroring
/// <c>CreateInvoiceCommandHandlerTests</c>).
/// </summary>
public sealed class AutomationCommandHandlerTests
{
    private readonly Mock<IAutomationDefinitionRepository> _repo = new();
    private readonly Mock<IEmailTemplateRepository> _templates = new();
    private readonly Mock<IAuditService> _audit = new();

    public AutomationCommandHandlerTests()
    {
        _templates.Setup(t => t.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(EmailTemplate.Create("Welcome", "S", "<p>x</p>", "x", "Cat"));
    }

    private static CreateAutomationCommand CreateCmd() => new()
    {
        Name = "Welcome",
        TemplateId = 1,
        TriggerType = AutomationTriggerType.MemberJoined,
        SegmentType = RecipientSegmentType.AllActiveMembers,
        CreatedById = Guid.NewGuid(),
        CreatedByName = "tester"
    };

    [Fact]
    public async Task Create_PersistsDraft_AndAudits()
    {
        AutomationDefinition? saved = null;
        _repo.Setup(r => r.AddAsync(It.IsAny<AutomationDefinition>(), It.IsAny<CancellationToken>()))
            .Callback<AutomationDefinition, CancellationToken>((d, _) => saved = d)
            .Returns(Task.CompletedTask);

        var handler = new CreateAutomationCommandHandler(_repo.Object, _templates.Object, _audit.Object);
        var dto = await handler.Handle(CreateCmd(), CancellationToken.None);

        saved.Should().NotBeNull();
        saved!.Status.Should().Be(AutomationStatus.Draft);
        dto.Name.Should().Be("Welcome");
        dto.Status.Should().Be(AutomationStatus.Draft);
        dto.TemplateName.Should().Be("Welcome");

        _audit.Verify(a => a.LogActionAsync(
            AuditEventType.SettingsChanged, It.IsAny<string>(), true, null,
            "AutomationDefinition", saved.Id.ToString(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Activate_TransitionsAndAudits()
    {
        var definition = AutomationDefinition.Create(
            "J", null, 1, AutomationTrigger.Create(AutomationTriggerType.MemberJoined, null),
            RecipientSegmentType.AllActiveMembers, null, null, Guid.NewGuid(), "tester");

        _repo.Setup(r => r.GetByIdAsync(definition.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(definition);
        _repo.Setup(r => r.UpdateAsync(It.IsAny<AutomationDefinition>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var handler = new ActivateAutomationCommandHandler(_repo.Object, _templates.Object, _audit.Object);
        var dto = await handler.Handle(new ActivateAutomationCommand(definition.Id), CancellationToken.None);

        dto.Should().NotBeNull();
        dto!.Status.Should().Be(AutomationStatus.Active);
        _audit.Verify(a => a.LogActionAsync(
            AuditEventType.SettingsChanged, It.IsAny<string>(), true, null,
            "AutomationDefinition", definition.Id.ToString(), It.IsAny<string?>(), It.IsAny<CancellationToken>()),
            Times.Once);
    }

    [Fact]
    public async Task Lifecycle_NotFound_ReturnsNull()
    {
        _repo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AutomationDefinition?)null);

        var handler = new PauseAutomationCommandHandler(_repo.Object, _templates.Object, _audit.Object);
        var dto = await handler.Handle(new PauseAutomationCommand(Guid.NewGuid()), CancellationToken.None);

        dto.Should().BeNull();
    }

    [Fact]
    public async Task Update_NotFound_ReturnsNull()
    {
        _repo.Setup(r => r.GetByIdAsync(It.IsAny<Guid>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((AutomationDefinition?)null);

        var handler = new UpdateAutomationCommandHandler(_repo.Object, _templates.Object, _audit.Object);
        var dto = await handler.Handle(new UpdateAutomationCommand
        {
            Id = Guid.NewGuid(),
            Name = "x",
            TemplateId = 1,
            TriggerType = AutomationTriggerType.MemberJoined,
            SegmentType = RecipientSegmentType.AllActiveMembers
        }, CancellationToken.None);

        dto.Should().BeNull();
    }
}
