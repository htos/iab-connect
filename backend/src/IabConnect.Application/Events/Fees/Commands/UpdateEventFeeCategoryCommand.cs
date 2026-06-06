using FluentValidation;
using IabConnect.Domain.Events;
using MediatR;

namespace IabConnect.Application.Events.Fees.Commands;

/// <summary>
/// REQ-022 (E4-S1): Update an existing fee category. <paramref name="EventId"/> is the route's
/// event id and is checked against the category's owner to reject cross-event tampering.
/// </summary>
public sealed record UpdateEventFeeCategoryCommand(
    Guid EventId,
    Guid CategoryId,
    string Name,
    string? Description,
    decimal Amount,
    string Currency,
    string Applicability,
    DateTime? AvailableFrom,
    DateTime? AvailableUntil,
    int? MaxQuantity) : IRequest<EventFeeCategoryDto>;

public sealed class UpdateEventFeeCategoryCommandValidator : AbstractValidator<UpdateEventFeeCategoryCommand>
{
    public UpdateEventFeeCategoryCommandValidator()
    {
        RuleFor(x => x.EventId).NotEqual(Guid.Empty);
        RuleFor(x => x.CategoryId).NotEqual(Guid.Empty);
        RuleFor(x => x.Name)
            .NotEmpty()
            .Must(n => !string.IsNullOrWhiteSpace(n)).WithMessage("Name is required.")
            .MaximumLength(EventFeeCategory.NameMaxLength);
        RuleFor(x => x.Description).MaximumLength(EventFeeCategory.DescriptionMaxLength);
        RuleFor(x => x.Amount)
            .GreaterThanOrEqualTo(0)
            .Must(a => decimal.Round(a, 2) == a).WithMessage("Amount cannot have more than 2 decimal places.");
        RuleFor(x => x.Currency)
            .Must(FeeCurrencies.IsSupported)
            .WithMessage($"Currency must be one of: {FeeCurrencies.SupportedList}.");
        RuleFor(x => x.Applicability)
            .Must(FeeApplicabilityParsing.IsValid)
            .WithMessage("Applicability must be one of: Everyone, MembersOnly, PublicOnly.");
        RuleFor(x => x.MaxQuantity).GreaterThanOrEqualTo(1).When(x => x.MaxQuantity.HasValue);
        RuleFor(x => x)
            .Must(x => !(x.AvailableFrom.HasValue && x.AvailableUntil.HasValue) || x.AvailableUntil > x.AvailableFrom)
            .WithMessage("AvailableUntil must be after AvailableFrom.");
    }
}

public sealed class UpdateEventFeeCategoryCommandHandler
    : IRequestHandler<UpdateEventFeeCategoryCommand, EventFeeCategoryDto>
{
    private readonly IEventFeeCategoryRepository _categories;

    public UpdateEventFeeCategoryCommandHandler(IEventFeeCategoryRepository categories)
    {
        _categories = categories;
    }

    public async Task<EventFeeCategoryDto> Handle(UpdateEventFeeCategoryCommand request, CancellationToken cancellationToken)
    {
        var category = await _categories.GetByIdAsync(request.CategoryId, cancellationToken)
            ?? throw new KeyNotFoundException($"Fee category {request.CategoryId} not found.");

        // Reject cross-event tampering (event A manager editing event B's category).
        if (category.EventId != request.EventId)
            throw new KeyNotFoundException($"Fee category {request.CategoryId} not found.");

        if (await _categories.ActiveNameExistsAsync(request.EventId, request.Name, excludingId: request.CategoryId, cancellationToken))
            throw new InvalidOperationException($"An active fee category named '{request.Name.Trim()}' already exists for this event.");

        var applicability = FeeApplicabilityParsing.Parse(request.Applicability);
        category.UpdateDetails(
            request.Name, request.Amount, request.Currency, applicability,
            request.Description, request.AvailableFrom, request.AvailableUntil, request.MaxQuantity);

        await _categories.UpdateAsync(category, cancellationToken);
        return EventFeeCategoryDto.FromEntity(category);
    }
}
