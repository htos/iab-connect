using IabConnect.Application.Common;
using MediatR;

namespace IabConnect.Application.ModuleSettings.Queries;

/// <summary>
/// REQ-087 (E10-S2): returns every module setting with its last-changed metadata, for the
/// Modules admin tab. Auto-discovered by MediatR's <c>RegisterServicesFromAssembly</c>.
/// </summary>
public sealed record GetModuleSettingsQuery : IRequest<IReadOnlyList<ModuleSettingDto>>;

public sealed class GetModuleSettingsQueryHandler
    : IRequestHandler<GetModuleSettingsQuery, IReadOnlyList<ModuleSettingDto>>
{
    private readonly IModuleSettingsRepository _repository;

    public GetModuleSettingsQueryHandler(IModuleSettingsRepository repository)
    {
        _repository = repository;
    }

    public async Task<IReadOnlyList<ModuleSettingDto>> Handle(
        GetModuleSettingsQuery request,
        CancellationToken cancellationToken)
    {
        var settings = await _repository.GetAllAsync(cancellationToken);
        return settings.Select(ModuleSettingDto.FromEntity).ToList();
    }
}
