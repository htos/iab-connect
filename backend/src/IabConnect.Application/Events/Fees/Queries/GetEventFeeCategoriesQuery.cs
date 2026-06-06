using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Events.Fees.Queries;

/// <summary>
/// REQ-022 (E4-S1): List the fee categories for an event. <paramref name="IncludeInactive"/> is the
/// admin view (shows retired categories); false returns active-only (the registrant view).
/// </summary>
public sealed record GetEventFeeCategoriesQuery(Guid EventId, bool IncludeInactive = false)
    : IRequest<IReadOnlyList<EventFeeCategoryDto>>;

public sealed class GetEventFeeCategoriesQueryHandler
    : IRequestHandler<GetEventFeeCategoriesQuery, IReadOnlyList<EventFeeCategoryDto>>
{
    private readonly IEventFeeCategoryRepository _categories;
    private readonly IEventRepository _events;

    public GetEventFeeCategoriesQueryHandler(
        IEventFeeCategoryRepository categories,
        IEventRepository events)
    {
        _categories = categories;
        _events = events;
    }

    public async Task<IReadOnlyList<EventFeeCategoryDto>> Handle(
        GetEventFeeCategoriesQuery request, CancellationToken cancellationToken)
    {
        // Verify the event exists before returning its categories — closes the GUID-enumeration gap
        // (an empty list and a non-existent event must not be distinguishable to a probing caller).
        var evt = await _events.GetByIdAsync(request.EventId, cancellationToken);
        if (evt is null || evt.IsDeleted)
            throw new KeyNotFoundException($"Event {request.EventId} not found.");

        var categories = await _categories.GetByEventIdAsync(request.EventId, request.IncludeInactive, cancellationToken);
        return categories.Select(EventFeeCategoryDto.FromEntity).ToList();
    }
}
