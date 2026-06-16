using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Commands;

/// <summary>REQ-058 (E8-S1, AC-1/4): revoke a credential so it can no longer authenticate.</summary>
public sealed record RevokeApiClientCommand(Guid Id) : IRequest<bool>;

/// <summary>
/// Returns false when the credential does not exist (→ 404). Revoking an already-revoked credential
/// is a no-op success (idempotent from the caller's perspective). Audited as
/// <see cref="AuditEventType.ApiClientRevoked"/>.
/// </summary>
public sealed class RevokeApiClientCommandHandler : IRequestHandler<RevokeApiClientCommand, bool>
{
    private readonly IApiClientRepository _repository;
    private readonly IAuditService _auditService;

    public RevokeApiClientCommandHandler(IApiClientRepository repository, IAuditService auditService)
    {
        _repository = repository;
        _auditService = auditService;
    }

    public async Task<bool> Handle(RevokeApiClientCommand request, CancellationToken ct)
    {
        var client = await _repository.GetByIdAsync(request.Id, ct);
        if (client is null)
            return false;

        if (!client.IsRevoked)
        {
            client.Revoke();
            await _repository.UpdateAsync(client, ct);

            await _auditService.LogActionAsync(
                AuditEventType.ApiClientRevoked,
                $"API client '{client.Name}' revoked",
                entityType: "ApiClient",
                entityId: client.Id.ToString(),
                ct: ct);
        }

        return true;
    }
}
