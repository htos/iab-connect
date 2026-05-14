using FluentAssertions;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Application.ModuleSettings.Commands;
using IabConnect.Application.ModuleSettings.Queries;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Common;
using Moq;
using Xunit;

namespace IabConnect.Application.Tests.ModuleSettings;

/// <summary>
/// REQ-087 (E10-S2): unit coverage for the module-settings MediatR slice — the read query,
/// the update command's write-through + cache-invalidation + audit, and the validator that
/// keeps unknown module keys out (there is no "admin" module — self-lockout guard AC-6).
/// </summary>
public sealed class ModuleSettingsCommandQueryTests
{
    private static ModuleSetting Seeded(string key, bool enabled) =>
        ModuleSetting.Create(key, enabled, updatedBy: null);

    // --- GetModuleSettingsQuery -------------------------------------------------

    [Fact]
    public async Task GetModuleSettingsQuery_ReturnsAllSettingsAsDtos()
    {
        var repo = new Mock<IModuleSettingsRepository>();
        repo.Setup(r => r.GetAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(ModuleKeys.All.Select(k => Seeded(k, enabled: true)).ToList());
        var handler = new GetModuleSettingsQueryHandler(repo.Object);

        var result = await handler.Handle(new GetModuleSettingsQuery(), TestContext.Current.CancellationToken);

        result.Should().HaveCount(7);
        result.Select(d => d.ModuleKey).Should().BeEquivalentTo(ModuleKeys.All);
        result.Should().OnlyContain(d => d.Enabled);
    }

    // --- UpdateModuleSettingCommandValidator ------------------------------------

    [Theory]
    [InlineData("members")]
    [InlineData("public_view")]
    [InlineData("finance")]
    public void Validator_AcceptsKnownModuleKeys(string key)
    {
        var validator = new UpdateModuleSettingCommandValidator();

        var result = validator.Validate(new UpdateModuleSettingCommand(key, true, "admin"));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("admin")]
    [InlineData("")]
    [InlineData("not-a-module")]
    public void Validator_RejectsUnknownOrEmptyModuleKeys(string key)
    {
        var validator = new UpdateModuleSettingCommandValidator();

        var result = validator.Validate(new UpdateModuleSettingCommand(key, false, "admin"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(UpdateModuleSettingCommand.ModuleKey));
    }

    // --- UpdateModuleSettingCommandHandler --------------------------------------

    [Fact]
    public async Task UpdateCommand_UpdatesPersistsInvalidatesCacheAndAudits()
    {
        var setting = Seeded(ModuleKeys.Finance, enabled: true);
        var repo = new Mock<IModuleSettingsRepository>();
        repo.Setup(r => r.GetByKeyAsync(ModuleKeys.Finance, It.IsAny<CancellationToken>()))
            .ReturnsAsync(setting);
        var service = new Mock<IModuleSettingsService>();
        var unitOfWork = new Mock<IUnitOfWork>();
        var audit = new Mock<IAuditService>();

        var handler = new UpdateModuleSettingCommandHandler(
            repo.Object, service.Object, unitOfWork.Object, audit.Object);

        var dto = await handler.Handle(
            new UpdateModuleSettingCommand(ModuleKeys.Finance, false, "admin"),
            TestContext.Current.CancellationToken);

        dto.Enabled.Should().BeFalse();
        dto.UpdatedBy.Should().Be("admin");
        setting.Enabled.Should().BeFalse();
        repo.Verify(r => r.Update(setting), Times.Once);
        unitOfWork.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        service.Verify(s => s.InvalidateCache(), Times.Once);
        audit.Verify(a => a.LogActionAsync(
            AuditEventType.SettingsChanged,
            It.IsAny<string>(),
            It.IsAny<bool>(),
            It.IsAny<string?>(),
            "ModuleSetting",
            setting.Id.ToString(),
            It.IsAny<string?>(),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task UpdateCommand_UnknownKey_ThrowsKeyNotFound()
    {
        var repo = new Mock<IModuleSettingsRepository>();
        repo.Setup(r => r.GetByKeyAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((ModuleSetting?)null);
        var handler = new UpdateModuleSettingCommandHandler(
            repo.Object,
            new Mock<IModuleSettingsService>().Object,
            new Mock<IUnitOfWork>().Object,
            new Mock<IAuditService>().Object);

        var act = async () => await handler.Handle(
            new UpdateModuleSettingCommand(ModuleKeys.Members, false, "admin"),
            TestContext.Current.CancellationToken);

        await act.Should().ThrowAsync<KeyNotFoundException>();
    }
}
