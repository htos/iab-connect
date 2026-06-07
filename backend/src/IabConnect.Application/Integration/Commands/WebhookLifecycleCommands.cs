using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Commands;

/// <summary>REQ-058 (E8-S3, AC-1/5): disable / enable / delete a webhook subscription. Return false → 404.</summary>
public sealed record DisableWebhookSubscriptionCommand(Guid Id) : IRequest<bool>;
public sealed record EnableWebhookSubscriptionCommand(Guid Id) : IRequest<bool>;
public sealed record DeleteWebhookSubscriptionCommand(Guid Id) : IRequest<bool>;

public sealed class DisableWebhookSubscriptionCommandHandler : IRequestHandler<DisableWebhookSubscriptionCommand, bool>
{
    private readonly IWebhookSubscriptionRepository _repository;
    private readonly IAuditService _audit;
    public DisableWebhookSubscriptionCommandHandler(IWebhookSubscriptionRepository repository, IAuditService audit)
        => (_repository, _audit) = (repository, audit);

    public async Task<bool> Handle(DisableWebhookSubscriptionCommand request, CancellationToken ct)
    {
        var sub = await _repository.GetByIdAsync(request.Id, ct);
        if (sub is null) return false;
        sub.Disable();
        await _repository.UpdateAsync(sub, ct);
        await _audit.LogActionAsync(AuditEventType.WebhookSubscriptionChanged,
            $"Webhook subscription '{sub.Name}' disabled", entityType: "WebhookSubscription", entityId: sub.Id.ToString(), ct: ct);
        return true;
    }
}

public sealed class EnableWebhookSubscriptionCommandHandler : IRequestHandler<EnableWebhookSubscriptionCommand, bool>
{
    private readonly IWebhookSubscriptionRepository _repository;
    private readonly IAuditService _audit;
    public EnableWebhookSubscriptionCommandHandler(IWebhookSubscriptionRepository repository, IAuditService audit)
        => (_repository, _audit) = (repository, audit);

    public async Task<bool> Handle(EnableWebhookSubscriptionCommand request, CancellationToken ct)
    {
        var sub = await _repository.GetByIdAsync(request.Id, ct);
        if (sub is null) return false;
        sub.Enable();
        await _repository.UpdateAsync(sub, ct);
        await _audit.LogActionAsync(AuditEventType.WebhookSubscriptionChanged,
            $"Webhook subscription '{sub.Name}' enabled", entityType: "WebhookSubscription", entityId: sub.Id.ToString(), ct: ct);
        return true;
    }
}

public sealed class DeleteWebhookSubscriptionCommandHandler : IRequestHandler<DeleteWebhookSubscriptionCommand, bool>
{
    private readonly IWebhookSubscriptionRepository _repository;
    private readonly IAuditService _audit;
    public DeleteWebhookSubscriptionCommandHandler(IWebhookSubscriptionRepository repository, IAuditService audit)
        => (_repository, _audit) = (repository, audit);

    public async Task<bool> Handle(DeleteWebhookSubscriptionCommand request, CancellationToken ct)
    {
        var sub = await _repository.GetByIdAsync(request.Id, ct);
        if (sub is null) return false;
        var name = sub.Name;
        await _repository.DeleteAsync(sub, ct);
        await _audit.LogActionAsync(AuditEventType.WebhookSubscriptionChanged,
            $"Webhook subscription '{name}' deleted", entityType: "WebhookSubscription", entityId: request.Id.ToString(), ct: ct);
        return true;
    }
}
