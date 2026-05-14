using IabConnect.Domain.Common;

namespace IabConnect.Application.ModuleSettings;

/// <summary>
/// Read model for a single module's enablement state (REQ-087, Epic E10). Carries the
/// last-changed metadata so the Modules admin tab can show <c>updated_at</c> / <c>updated_by</c>.
/// </summary>
public sealed record ModuleSettingDto(
    string ModuleKey,
    bool Enabled,
    DateTime UpdatedAt,
    string? UpdatedBy)
{
    public static ModuleSettingDto FromEntity(ModuleSetting setting) =>
        new(setting.ModuleKey, setting.Enabled, setting.UpdatedAt, setting.UpdatedBy);
}
