using IabConnect.Application.Common;
using IabConnect.Application.Communication.Automations;
using IabConnect.Domain.Common;
using IabConnect.Infrastructure.Communication.Jobs;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests.Communication;

/// <summary>
/// REQ-028 (E5-S2) AC-1: the dispatch job no-ops when the Communication module is disabled and
/// delegates to the execution service when enabled (mirrors the volunteer-job module-skip).
/// </summary>
public sealed class AutomationDispatchJobTests
{
    private readonly Mock<IAutomationExecutionService> _service = new();
    private readonly Mock<IModuleSettingsService> _modules = new();

    private AutomationDispatchJob Build() =>
        new(_service.Object, _modules.Object, NullLogger<AutomationDispatchJob>.Instance);

    [Fact]
    public async Task DisabledModule_SkipsDispatch()
    {
        _modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Communication, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        await Build().ExecuteAsync(TestContext.Current.CancellationToken);

        _service.Verify(s => s.ExecuteDueAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task EnabledModule_RunsDispatch()
    {
        _modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Communication, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);
        _service.Setup(s => s.ExecuteDueAsync(It.IsAny<CancellationToken>())).ReturnsAsync(3);

        await Build().ExecuteAsync(TestContext.Current.CancellationToken);

        _service.Verify(s => s.ExecuteDueAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
