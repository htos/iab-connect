using FluentValidation;
using IabConnect.Application.Audit;
using IabConnect.Domain.Audit;
using IabConnect.Domain.Integration;
using MediatR;

namespace IabConnect.Application.Integration.Commands;

/// <summary>REQ-058 (E8-S3, AC-1/4): create a webhook subscription; the response carries the signing secret once.</summary>
public sealed record CreateWebhookSubscriptionCommand : IRequest<WebhookSubscriptionCreatedDto>
{
    public required string Name { get; init; }
    public required string TargetUrl { get; init; }
    public required IReadOnlyCollection<string> EventTypes { get; init; }
}

public sealed class CreateWebhookSubscriptionCommandValidator : AbstractValidator<CreateWebhookSubscriptionCommand>
{
    public CreateWebhookSubscriptionCommandValidator()
    {
        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.TargetUrl)
            .NotEmpty()
            .Must(BeAbsoluteHttps).WithMessage("Target URL must be an absolute https:// URL.");
        RuleFor(x => x.EventTypes).NotEmpty().WithMessage("At least one event type must be subscribed.");
        RuleForEach(x => x.EventTypes)
            .Must(t => WebhookEventTypes.All.Contains(t))
            .WithMessage(t => $"Unknown webhook event type '{t}'. Valid: {string.Join(", ", WebhookEventTypes.All)}.");
    }

    internal static bool BeAbsoluteHttps(string url) =>
        Uri.TryCreate(url, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps;
}

public sealed class CreateWebhookSubscriptionCommandHandler
    : IRequestHandler<CreateWebhookSubscriptionCommand, WebhookSubscriptionCreatedDto>
{
    private readonly IWebhookSubscriptionRepository _repository;
    private readonly IWebhookSecretService _secretService;
    private readonly IAuditService _auditService;

    public CreateWebhookSubscriptionCommandHandler(
        IWebhookSubscriptionRepository repository,
        IWebhookSecretService secretService,
        IAuditService auditService)
    {
        _repository = repository;
        _secretService = secretService;
        _auditService = auditService;
    }

    public async Task<WebhookSubscriptionCreatedDto> Handle(CreateWebhookSubscriptionCommand request, CancellationToken ct)
    {
        var secret = _secretService.Generate();
        var sub = WebhookSubscription.Create(request.Name, request.TargetUrl, request.EventTypes, secret.ProtectedSecret);

        await _repository.AddAsync(sub, ct);

        await _auditService.LogActionAsync(
            AuditEventType.WebhookSubscriptionChanged,
            $"Webhook subscription '{sub.Name}' created → {sub.TargetUrl} [{string.Join(", ", sub.EventTypes)}]",
            entityType: "WebhookSubscription",
            entityId: sub.Id.ToString(),
            ct: ct);

        // The cleartext signing secret leaves the system here, exactly once.
        return new WebhookSubscriptionCreatedDto(sub.Id, sub.Name, sub.TargetUrl, sub.EventTypes, secret.RawSecret, sub.CreatedAt);
    }
}
