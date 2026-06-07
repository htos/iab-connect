using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Communication;
using IabConnect.Application.Communication.Automations;
using IabConnect.Application.Communication.Messaging;
using IabConnect.Domain.Communication;
using IabConnect.Infrastructure.Communication;
using IabConnect.Infrastructure.Email;
using IabConnect.Infrastructure.Messaging;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Communication;

/// <summary>
/// REQ-028 (E5-S2) AC-3/AC-4/AC-7: unit tests for the dispatch engine with mocked boundaries —
/// the idempotency run-twice headline (exactly one send per recipient) and per-recipient failure
/// isolation (one throws, others Sent, FailedCount correct, batch completes).
/// </summary>
public sealed class AutomationExecutionServiceTests
{
    private readonly Mock<IAutomationDefinitionRepository> _defs = new();
    private readonly Mock<IAutomationExecutionRepository> _execs = new();
    private readonly Mock<IRecipientResolutionService> _resolver = new();
    private readonly Mock<IEmailTemplateRepository> _templates = new();
    private readonly Mock<IEmailSender> _email = new();
    private readonly Mock<IAuditService> _audit = new();
    private readonly HashSet<string> _existingKeys = new();
    private readonly List<AutomationExecution> _saved = [];

    private AutomationExecutionService BuildSut(IChannelPreferenceService? preferences = null)
    {
        _execs.Setup(e => e.ExistingRecipientKeysAsync(It.IsAny<IReadOnlyCollection<string>>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((IReadOnlyCollection<string> keys, CancellationToken _) =>
                keys.Where(_existingKeys.Contains).ToList());
        _execs.Setup(e => e.AddAsync(It.IsAny<AutomationExecution>(), It.IsAny<CancellationToken>()))
            .Callback<AutomationExecution, CancellationToken>((ex, _) =>
            {
                _saved.Add(ex);
                // Simulate persistence: the recipient keys now "exist" for subsequent runs.
                foreach (var r in ex.Recipients)
                    _existingKeys.Add(r.IdempotencyKey);
            })
            .Returns(Task.CompletedTask);
        // Claim-before-send (AC-3): the execution is saved as Pending up-front (AddAsync) then the
        // final per-recipient outcomes are persisted via UpdateAsync.
        _execs.Setup(e => e.UpdateAsync(It.IsAny<AutomationExecution>(), It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);
        _templates.Setup(t => t.GetByIdAsync(It.IsAny<int>()))
            .ReturnsAsync(EmailTemplate.Create("Welcome", "Hi {{firstName}}", "<p>Hi {{firstName}}</p>", "Hi {{firstName}}", "Cat"));

        // S4 (DEC-3): the automation send path goes through IMessageDispatcher. Build a real
        // dispatcher over a real EmailChannelSender wrapping the mocked IEmailSender, so these tests
        // still assert IEmailSender.SendAsync was called the right number of times (email is the
        // default channel — S2's idempotency semantics are unchanged by the S4 swap).
        var dispatcher = new MessageDispatcher(
            new IMessageChannelSender[] { new EmailChannelSender(_email.Object) },
            NullLogger<MessageDispatcher>.Instance);

        // S5: the send path consults IChannelPreferenceService. Default = email-always-eligible so
        // these S2 tests keep their semantics; a test can inject a stub (e.g. returns null = skip).
        return new AutomationExecutionService(
            _defs.Object, _execs.Object, _resolver.Object, _templates.Object, dispatcher,
            preferences ?? new DefaultChannelPreferenceService(),
            _audit.Object, new AutomationTriggerEvaluator(), TimeProvider.System,
            Options.Create(new SmtpSettings()), NullLogger<AutomationExecutionService>.Instance);
    }

    private void SetupOneActiveDefinitionWith(params ResolvedRecipient[] recipients)
    {
        var def = AutomationDefinition.Create(
            "Welcome", null, 1, AutomationTrigger.Create(AutomationTriggerType.MemberJoined, null),
            RecipientSegmentType.AllActiveMembers, null, null, Guid.NewGuid(), "tester");
        def.Activate();
        _defs.Setup(d => d.GetActiveAsync(It.IsAny<CancellationToken>())).ReturnsAsync([def]);
        _resolver.Setup(r => r.ResolveAsync(
                It.IsAny<RecipientSegmentType>(), It.IsAny<string?>(), It.IsAny<Domain.Privacy.ConsentType?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(recipients.ToList());
    }

    private static ResolvedRecipient R(string email) =>
        new(Guid.NewGuid(), Guid.NewGuid(), email, "First", "Last");

    [Fact]
    public async Task RunTwice_OverSameDueData_SendsExactlyOncePerRecipient()
    {
        SetupOneActiveDefinitionWith(R("a@example.com"), R("b@example.com"));
        var sut = BuildSut();

        var sent1 = await sut.ExecuteDueAsync(CancellationToken.None);
        var sent2 = await sut.ExecuteDueAsync(CancellationToken.None);

        sent1.Should().Be(2);
        sent2.Should().Be(0, "the second run's occurrences are all already handled (idempotency pre-check)");

        _email.Verify(e => e.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Exactly(2));

        _saved.Should().HaveCount(1, "only the first run has fresh work, so only one execution is recorded");
        _saved[0].Recipients.Should().HaveCount(2);
        _saved[0].Recipients.Should().OnlyContain(r => r.Status == AutomationRecipientStatus.Sent);
    }

    [Fact]
    public async Task PerRecipientFailure_IsIsolated_BatchContinues()
    {
        SetupOneActiveDefinitionWith(R("good@example.com"), R("bad@example.com"));
        _email.Setup(e => e.SendAsync(
                "bad@example.com", It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
                It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("SMTP boom"));
        var sut = BuildSut();

        var sent = await sut.ExecuteDueAsync(CancellationToken.None);

        sent.Should().Be(1);
        _saved.Should().HaveCount(1);
        var execution = _saved[0];
        execution.SentCount.Should().Be(1);
        execution.FailedCount.Should().Be(1);
        execution.Status.Should().Be(AutomationExecutionStatus.Completed);
        execution.Recipients.Single(r => r.Status == AutomationRecipientStatus.Failed)
            .ErrorMessage.Should().Contain("SMTP boom");
    }

    [Fact]
    public async Task ClaimCollision_AbandonsRun_WithoutSending()
    {
        // AC-3 crash/concurrency safety: if the up-front Pending claim collides with a concurrent
        // run (unique-index DbUpdateException), the run is abandoned BEFORE any send — no duplicate.
        SetupOneActiveDefinitionWith(R("a@example.com"));
        var sut = BuildSut();
        // override AFTER BuildSut (last Setup wins) so the claim insert throws a unique-violation
        _execs.Setup(e => e.AddAsync(It.IsAny<AutomationExecution>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Microsoft.EntityFrameworkCore.DbUpdateException("unique violation"));

        var sent = await sut.ExecuteDueAsync(CancellationToken.None);

        sent.Should().Be(0);
        _email.Verify(e => e.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never,
            "nothing is sent when the claim collides");
    }

    [Fact]
    public async Task ClaimIsPersistedBeforeSending()
    {
        // The execution is AddAsync'd with all recipients in Pending state BEFORE the send loop runs.
        AutomationRecipientStatus statusAtClaim = AutomationRecipientStatus.Sent;
        SetupOneActiveDefinitionWith(R("a@example.com"));
        var sut = BuildSut();
        // override AFTER BuildSut so the callback also records the recipient status at claim time
        _execs.Setup(e => e.AddAsync(It.IsAny<AutomationExecution>(), It.IsAny<CancellationToken>()))
            .Callback<AutomationExecution, CancellationToken>((ex, _) =>
            {
                _saved.Add(ex);
                statusAtClaim = ex.Recipients[0].Status; // captured at claim time, before send
                foreach (var r in ex.Recipients) _existingKeys.Add(r.IdempotencyKey);
            })
            .Returns(Task.CompletedTask);

        await sut.ExecuteDueAsync(CancellationToken.None);

        statusAtClaim.Should().Be(AutomationRecipientStatus.Pending,
            "the idempotency key is committed as a Pending claim before the message is sent");
    }

    [Fact]
    public async Task NoActiveDefinitions_DoesNothing()
    {
        _defs.Setup(d => d.GetActiveAsync(It.IsAny<CancellationToken>())).ReturnsAsync([]);
        var sut = BuildSut();

        var sent = await sut.ExecuteDueAsync(CancellationToken.None);

        sent.Should().Be(0);
        _saved.Should().BeEmpty();
    }

    [Fact]
    public async Task IneligibleRecipient_IsSkipped_NotSent()
    {
        // S5: a stub preference service that returns null (e.g. consent revoked) → the recipient is
        // recorded Skipped, never sent on any channel.
        SetupOneActiveDefinitionWith(R("a@example.com"));
        var prefs = new Mock<IChannelPreferenceService>();
        prefs.Setup(p => p.ResolveChannelAsync(
                It.IsAny<Guid?>(), It.IsAny<MessageChannel>(), It.IsAny<Domain.Privacy.ConsentType?>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((MessageChannel?)null);
        var sut = BuildSut(prefs.Object);

        var sent = await sut.ExecuteDueAsync(CancellationToken.None);

        sent.Should().Be(0);
        _saved[0].SkippedCount.Should().Be(1);
        _email.Verify(e => e.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task RecipientWithoutEmail_IsSkipped_NotSent()
    {
        SetupOneActiveDefinitionWith(new ResolvedRecipient(Guid.NewGuid(), Guid.NewGuid(), "", "No", "Email"));
        var sut = BuildSut();

        var sent = await sut.ExecuteDueAsync(CancellationToken.None);

        sent.Should().Be(0);
        _saved[0].SkippedCount.Should().Be(1);
        _email.Verify(e => e.SendAsync(
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string?>(),
            It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }
}
