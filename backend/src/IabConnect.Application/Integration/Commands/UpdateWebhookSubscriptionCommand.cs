using FluentValidation;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Commands;

/// <summary>REQ-058 (E8-S3, AC-1/5): edit a webhook subscription's name, target URL and event types.</summary>
public sealed record UpdateWebhookSubscriptionCommand : IRequest<WebhookSubscriptionDto?>
{
    public required Guid Id { get; init; }
    public required string Name { get; init; }
    public required string TargetUrl { get; init; }
    public required IReadOnlyCollection<string> EventTypes { get; init; }
}

public sealed class UpdateWebhookSubscriptionCommandValidator : AbstractValidator<UpdateWebhookSubscriptionCommand>
{
    public UpdateWebhookSubscriptionCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TargetUrl)
            .NotEmpty()
            .Must(CreateWebhookSubscriptionCommandValidator.BeAbsoluteHttps)
            .WithMessage("Target URL must be an absolute https:// URL.");
        RuleFor(x => x.EventTypes).NotEmpty();
        RuleForEach(x => x.EventTypes)
            .Must(t => WebhookEventTypes.All.Contains(t))
            .WithMessage(t => $"Unknown webhook event type '{t}'.");
    }
}

public sealed class UpdateWebhookSubscriptionCommandHandler
    : IRequestHandler<UpdateWebhookSubscriptionCommand, WebhookSubscriptionDto?>
{
    private readonly IWebhookSubscriptionRepository _repository;
    private readonly IAuditService _auditService;

    public UpdateWebhookSubscriptionCommandHandler(IWebhookSubscriptionRepository repository, IAuditService auditService)
    {
        _repository = repository;
        _auditService = auditService;
    }

    public async Task<WebhookSubscriptionDto?> Handle(UpdateWebhookSubscriptionCommand request, CancellationToken ct)
    {
        var sub = await _repository.GetByIdAsync(request.Id, ct);
        if (sub is null) return null;

        sub.UpdateConfiguration(request.Name, request.TargetUrl, request.EventTypes);
        await _repository.UpdateAsync(sub, ct);

        await _auditService.LogActionAsync(
            AuditEventType.WebhookSubscriptionChanged,
            $"Webhook subscription '{sub.Name}' updated",
            entityType: "WebhookSubscription",
            entityId: sub.Id.ToString(),
            ct: ct);

        return WebhookSubscriptionDto.FromEntity(sub);
    }
}
