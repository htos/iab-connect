using IabConnect.Domain.Communication;
using IabConnect.Domain.Privacy;
using MediatR;

namespace IabConnect.Application.Communication.Automations.Queries;

/// <summary>
/// REQ-028 (E5-S1, AC-3): preview the resolved recipient set (count + bounded sample) for a
/// recipient rule, BEFORE activation. The server computes it through
/// <see cref="IRecipientResolutionService"/> (consent + segment honoured) — the browser only renders.
/// </summary>
public sealed record PreviewAutomationRecipientsQuery : IRequest<RecipientPreviewDto>
{
    public required RecipientSegmentType SegmentType { get; init; }
    public string? SegmentFilter { get; init; }
    public ConsentType? ConsentFilter { get; init; }
}

public sealed class PreviewAutomationRecipientsQueryHandler
    : IRequestHandler<PreviewAutomationRecipientsQuery, RecipientPreviewDto>
{
    private readonly IRecipientResolutionService _resolver;

    public PreviewAutomationRecipientsQueryHandler(IRecipientResolutionService resolver)
    {
        _resolver = resolver;
    }

    public async Task<RecipientPreviewDto> Handle(PreviewAutomationRecipientsQuery request, CancellationToken ct)
    {
        var result = await _resolver.PreviewAsync(
            request.SegmentType, request.SegmentFilter, request.ConsentFilter, sampleSize: 10, ct);

        var sample = result.Sample
            .Select(r => new RecipientSampleDto(r.MemberId, r.Email, r.FirstName, r.LastName))
            .ToList();

        return new RecipientPreviewDto(result.TotalCount, sample);
    }
}
