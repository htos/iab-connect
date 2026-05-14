using System.Text.Json;
using FluentValidation;
using IabConnect.Application.Audit;
using IabConnect.Application.Common;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Common;
using MediatR;

namespace IabConnect.Application.ModuleSettings.Commands;

/// <summary>
/// REQ-087 (E10-S2): enable or disable a single module. Writes through
/// <see cref="IModuleSettingsRepository"/> + <see cref="IUnitOfWork"/>, invalidates the
/// <see cref="IModuleSettingsService"/> cache, and audits the change.
///
/// <para><c>UpdatedBy</c> is supplied by the endpoint from the JWT (the established
/// pattern — there is no usable <c>ICurrentUser</c> in the Application layer); the story's
/// two-parameter sketch is extended by this audit field.</para>
/// </summary>
public sealed record UpdateModuleSettingCommand(
    string ModuleKey,
    bool Enabled,
    string? UpdatedBy) : IRequest<ModuleSettingDto>;

/// <summary>
/// Rejects any <see cref="UpdateModuleSettingCommand.ModuleKey"/> that is not one of the
/// canonical <see cref="ModuleKeys"/> — there is no "admin" module, so the API surface
/// cannot be used to gate a non-existent module (self-lockout guard, AC-6).
/// </summary>
public sealed class UpdateModuleSettingCommandValidator : AbstractValidator<UpdateModuleSettingCommand>
{
    public UpdateModuleSettingCommandValidator()
    {
        RuleFor(x => x.ModuleKey)
            .NotEmpty()
            .Must(key => ModuleKeys.All.Contains(key))
                .WithMessage(x => $"'{x.ModuleKey}' is not a known module key.");
    }
}

public sealed class UpdateModuleSettingCommandHandler
    : IRequestHandler<UpdateModuleSettingCommand, ModuleSettingDto>
{
    private readonly IModuleSettingsRepository _repository;
    private readonly IModuleSettingsService _moduleSettingsService;
    private readonly IUnitOfWork _unitOfWork;
    private readonly IAuditService _auditService;

    public UpdateModuleSettingCommandHandler(
        IModuleSettingsRepository repository,
        IModuleSettingsService moduleSettingsService,
        IUnitOfWork unitOfWork,
        IAuditService auditService)
    {
        _repository = repository;
        _moduleSettingsService = moduleSettingsService;
        _unitOfWork = unitOfWork;
        _auditService = auditService;
    }

    public async Task<ModuleSettingDto> Handle(
        UpdateModuleSettingCommand request,
        CancellationToken cancellationToken)
    {
        var setting = await _repository.GetByKeyAsync(request.ModuleKey, cancellationToken)
            ?? throw new KeyNotFoundException($"Module '{request.ModuleKey}' not found.");

        var wasEnabled = setting.Enabled;
        setting.SetEnabled(request.Enabled, request.UpdatedBy);
        _repository.Update(setting);
        await _unitOfWork.SaveChangesAsync(cancellationToken);

        // Drop the cached module map so the next read (frontend shell, middleware,
        // backend enforcement) sees the new state.
        _moduleSettingsService.InvalidateCache();

        // AC-5: module enable/disable is a sensitive admin action — audit it. Reuses
        // SettingsChanged, consistent with how SystemSettings edits are audited (Q1).
        var details = JsonSerializer.Serialize(new
        {
            setting.ModuleKey,
            OldEnabled = wasEnabled,
            NewEnabled = setting.Enabled,
        });

        await _auditService.LogActionAsync(
            AuditEventType.SettingsChanged,
            $"Module '{setting.ModuleKey}' {(setting.Enabled ? "enabled" : "disabled")}",
            entityType: "ModuleSetting",
            entityId: setting.Id.ToString(),
            details: details,
            ct: cancellationToken);

        return ModuleSettingDto.FromEntity(setting);
    }
}
