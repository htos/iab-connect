using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Commands;

/// <summary>
/// REQ-058 (E8-S1, AC-1/2/4): generates a token-safe secret, persists only its hash + prefix, and
/// returns the cleartext exactly once. Audited as <see cref="AuditEventType.ApiClientCreated"/>.
/// </summary>
public sealed class CreateApiClientCommandHandler : IRequestHandler<CreateApiClientCommand, ApiClientCreatedDto>
{
    private readonly IApiClientRepository _repository;
    private readonly IApiKeyHashingService _hashing;
    private readonly IAuditService _auditService;

    public CreateApiClientCommandHandler(
        IApiClientRepository repository,
        IApiKeyHashingService hashing,
        IAuditService auditService)
    {
        _repository = repository;
        _hashing = hashing;
        _auditService = auditService;
    }

    public async Task<ApiClientCreatedDto> Handle(CreateApiClientCommand request, CancellationToken ct)
    {
        var generated = _hashing.Generate();

        var client = ApiClient.Create(request.Name, request.Scopes, generated.Prefix, generated.Hash);

        await _repository.AddAsync(client, ct);

        await _auditService.LogActionAsync(
            AuditEventType.ApiClientCreated,
            $"API client '{client.Name}' created with scopes [{string.Join(", ", client.Scopes)}]",
            entityType: "ApiClient",
            entityId: client.Id.ToString(),
            ct: ct);

        // The cleartext secret leaves the system here, exactly once.
        return new ApiClientCreatedDto(client.Id, client.Name, client.Scopes, generated.RawSecret, client.CreatedAt);
    }
}
