using IabConnect.Application.Common;
using IabConnect.Application.Events.Jobs;
using IabConnect.Application.Finance.Jobs;
using IabConnect.Domain.Common;
using IabConnect.Infrastructure.Events.Jobs;
using IabConnect.Infrastructure.Finance.Jobs;
using Microsoft.Extensions.Logging.Abstractions;
using Moq;
using Xunit;

namespace IabConnect.Infrastructure.Tests;

/// <summary>
/// REQ-087 (E10-S5) AC-5: a disabled module's recurring Hangfire jobs no-op cleanly — they
/// must not invoke their work service (no emails, no DB writes) and must not throw.
/// </summary>
public sealed class ModuleGuardedJobTests
{
    [Fact]
    public async Task MarkInvoicesOverdueJob_SkipsWork_WhenFinanceDisabled()
    {
        var service = new Mock<IMarkInvoicesOverdueService>();
        var modules = new Mock<IModuleSettingsService>();
        modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Finance, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var job = new MarkInvoicesOverdueJob(
            service.Object, modules.Object, NullLogger<MarkInvoicesOverdueJob>.Instance);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        service.Verify(s => s.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task MarkInvoicesOverdueJob_RunsWork_WhenFinanceEnabled()
    {
        var service = new Mock<IMarkInvoicesOverdueService>();
        service.Setup(s => s.ExecuteAsync(It.IsAny<CancellationToken>())).ReturnsAsync(0);
        var modules = new Mock<IModuleSettingsService>();
        modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Finance, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var job = new MarkInvoicesOverdueJob(
            service.Object, modules.Object, NullLogger<MarkInvoicesOverdueJob>.Instance);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        service.Verify(s => s.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task DunningScheduleGenerationJob_SkipsWork_WhenFinanceDisabled()
    {
        var service = new Mock<IDunningScheduleService>();
        var modules = new Mock<IModuleSettingsService>();
        modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Finance, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var job = new DunningScheduleGenerationJob(
            service.Object, modules.Object, NullLogger<DunningScheduleGenerationJob>.Instance);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        service.Verify(s => s.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VolunteerShiftReminderJob_SkipsWork_WhenEventsDisabled()
    {
        var service = new Mock<IVolunteerShiftReminderService>();
        var modules = new Mock<IModuleSettingsService>();
        modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Events, It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var job = new VolunteerShiftReminderJob(
            service.Object, modules.Object, NullLogger<VolunteerShiftReminderJob>.Instance);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        service.Verify(s => s.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task VolunteerShiftReminderJob_RunsWork_WhenEventsEnabled()
    {
        var service = new Mock<IVolunteerShiftReminderService>();
        service.Setup(s => s.ExecuteAsync(It.IsAny<CancellationToken>())).ReturnsAsync(0);
        var modules = new Mock<IModuleSettingsService>();
        modules.Setup(m => m.IsEnabledAsync(ModuleKeys.Events, It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var job = new VolunteerShiftReminderJob(
            service.Object, modules.Object, NullLogger<VolunteerShiftReminderJob>.Instance);

        await job.ExecuteAsync(TestContext.Current.CancellationToken);

        service.Verify(s => s.ExecuteAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
