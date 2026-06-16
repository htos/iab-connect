using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Events.Fees.Commands;

/// <summary>
/// REQ-022 (E4-S1): Soft-retire a fee category (never hard-deleted — an E4-S2 invoice may
/// reference it). <paramref name="EventId"/> guards against cross-event tampering.
/// </summary>
public sealed record DeactivateEventFeeCategoryCommand(
    Guid EventId,
    Guid CategoryId) : IRequest<EventFeeCategoryDto>;

public sealed class DeactivateEventFeeCategoryCommandHandler
    : IRequestHandler<DeactivateEventFeeCategoryCommand, EventFeeCategoryDto>
{
    private readonly IEventFeeCategoryRepository _categories;

    public DeactivateEventFeeCategoryCommandHandler(IEventFeeCategoryRepository categories)
    {
        _categories = categories;
    }

    public async Task<EventFeeCategoryDto> Handle(DeactivateEventFeeCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _categories.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new KeyNotFoundException($"Fee category {request.CategoryId} not found.");

        if (category.EventId != request.EventId)
            throw new KeyNotFoundException($"Fee category {request.CategoryId} not found.");

        category.Deactivate();
        await _categories.UpdateAsync(category, cancellationToken);
        return EventFeeCategoryDto.FromEntity(category);
    }
}
